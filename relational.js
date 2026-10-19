// Ableitung des Relationenmodells und eines SQL-Skripts aus einem ER-Diagramm (Chen- oder Min-Max-Notation).
// Reine Funktionen ohne DOM – nutzbar im Browser (window.ERRelational) und in Node (module.exports).
(function (root) {
  'use strict';

  const MINMAX = /^\(\s*(\d+|[a-z*])\s*,\s*(\d+|[a-z*])\s*\)$/i;

  // Kardinalität einer Kante lesen: Chen („1“, „N“, „M“) oder Min-Max („(0,1)“, „(1,n)“)
  function cardinality(label) {
    const text = (label || '').trim();
    if (!text) return null;
    const m = MINMAX.exec(text);
    if (m) return { kind: 'minmax', min: m[1], maxOne: m[2] === '1' };
    if (text === '1') return { kind: 'chen', one: true };
    if (/^[nm*]$/i.test(text)) return { kind: 'chen', one: false };
    return null;
  }

  // Bezieht sich X (über Kante ex) auf höchstens ein Y (über Kante ey)?
  // Min-Max (look-here): max 1 an X. Chen (look-across): „1“ an Y.
  function refersToOne(ex, ey) {
    const cx = cardinality(ex.label), cy = cardinality(ey.label);
    if (cx && cx.kind === 'minmax') return cx.maxOne;
    if (cy && cy.kind === 'chen') return cy.one;
    return false;
  }

  // Nimmt X an jeder Beziehung teil (Pflicht)?
  function mandatory(ex) {
    const c = cardinality(ex.label);
    return Boolean(ex.total) || Boolean(c && c.kind === 'minmax' && c.min !== '0');
  }

  function guessType(name) {
    const n = name.toLowerCase();
    if (/(datum|date|tag)$/.test(n) || /geburt/.test(n)) return 'DATE';
    if (/(preis|betrag|gehalt|lohn|kosten|summe|note)$/.test(n)) return 'DECIMAL(10,2)';
    if (/(nr|nummer|id|anzahl|menge|alter|jahr|semester|plz)$/.test(n)) return 'INTEGER';
    return 'VARCHAR(255)';
  }

  function derive(diagram) {
    const nodes = new Map(diagram.nodes.map(n => [n.id, n]));
    const adj = new Map();
    for (const e of diagram.edges) {
      if (!nodes.has(e.from) || !nodes.has(e.to)) continue;
      for (const [a, b] of [[e.from, e.to], [e.to, e.from]]) {
        if (!adj.has(a)) adj.set(a, []);
        adj.get(a).push({ edge: e, other: nodes.get(b) });
      }
    }
    const links = n => adj.get(n.id) || [];
    const warnings = [];
    const tables = [];
    const tableOf = new Map();       // Knoten-ID -> Tabelle
    const usedNames = new Set();

    const cleanName = (name, fallback) => (String(name || '').trim() || fallback);
    function uniqueTable(name) {
      let candidate = name, i = 2;
      while (usedNames.has(candidate.toLowerCase())) candidate = `${name}_${i++}`;
      usedNames.add(candidate.toLowerCase());
      return candidate;
    }
    function addColumn(table, column) {
      let name = column.name, i = 2;
      while (table.columns.some(c => c.name.toLowerCase() === name.toLowerCase())) name = `${column.name}_${i++}`;
      table.columns.push({ type: guessType(column.name), ...column, name });
      return table.columns[table.columns.length - 1];
    }

    // Attribute eines Knotens, zusammengesetzte Attribute werden in ihre Teile aufgelöst
    function attributesOf(owner) {
      const result = [];
      const visit = (attr, from, key, prefixOwner) => {
        const children = links(attr).filter(l => l.other.type === 'attribute' && l.other.id !== from.id);
        const name = cleanName(attr.name, 'Attribut');
        if (attr.derived) { warnings.push(`„${name}“ (${prefixOwner}) ist abgeleitet und wird nicht gespeichert.`); return; }
        if (children.length && !attr.multi) {
          for (const c of children) visit(c.other, attr, key || attr.key, prefixOwner);
          return;
        }
        result.push({ name, key: Boolean(key || attr.key), partial: Boolean(attr.partial), multi: Boolean(attr.multi), node: attr });
      };
      for (const l of links(owner)) if (l.other.type === 'attribute') visit(l.other, owner, false, cleanName(owner.name, '?'));
      return result;
    }

    const pkColumns = table => table.columns.filter(c => c.pk);

    // Fremdschlüssel auf die Tabelle ref anlegen (alle Primärschlüsselspalten, optional mit Präfix)
    function addForeignKey(table, ref, prefix, asPk, group) {
      const added = [];
      for (const col of pkColumns(ref)) {
        const base = prefix ? `${prefix}_${col.name}` : col.name;
        const name = table.columns.some(c => c.name.toLowerCase() === base.toLowerCase()) && !prefix ? `${ref.name}_${col.name}` : base;
        added.push(addColumn(table, { name, type: col.type, pk: asPk, fk: { table: ref.name, column: col.name, group } }));
      }
      return added;
    }

    const entities = diagram.nodes.filter(n => n.type === 'entity');
    const relationships = diagram.nodes.filter(n => n.type === 'relationship');

    // 1) Entities
    for (const e of entities) {
      const table = { name: uniqueTable(cleanName(e.name, 'Entity')), columns: [], weak: Boolean(e.weak), node: e };
      tableOf.set(e.id, table);
      tables.push(table);
      for (const a of attributesOf(e)) {
        if (a.multi) continue;  // eigene Tabelle, siehe unten
        addColumn(table, { name: a.name, pk: a.key || (e.weak && a.partial) });
      }
    }

    // 2) Schwache Entities: Schlüssel des Besitzers über die identifizierende Beziehung übernehmen
    const resolved = new Set(entities.filter(e => !e.weak).map(e => e.id));
    for (let round = 0; round < entities.length; round++) {
      for (const e of entities) {
        if (resolved.has(e.id)) continue;
        const table = tableOf.get(e.id);
        const ident = links(e).map(l => l.other).find(r => r.type === 'relationship' && r.weak);
        const owner = ident && links(ident).map(l => l.other).find(o => o.type === 'entity' && o.id !== e.id);
        if (!owner) {
          warnings.push(`Schwache Entity „${table.name}“ hat keine identifizierende Beziehung – wie eine normale Entity behandelt.`);
          resolved.add(e.id);
          continue;
        }
        if (!resolved.has(owner.id)) continue;
        addForeignKey(table, tableOf.get(owner.id), '', true, `own${e.id}`);
        resolved.add(e.id);
      }
    }

    // Ohne Schlüssel: Ersatzschlüssel
    for (const table of tables) {
      if (!pkColumns(table).length) {
        warnings.push(`„${table.name}“ hat kein Schlüsselattribut – Ersatzschlüssel „${table.name}_ID“ ergänzt.`);
        table.columns.unshift({ name: `${table.name}_ID`, type: 'INTEGER', pk: true });
      }
    }

    // 3) Mehrwertige Attribute: eigene Tabelle (Schlüssel des Besitzers + Wert)
    for (const e of entities) {
      for (const a of attributesOf(e).filter(x => x.multi)) {
        const owner = tableOf.get(e.id);
        const table = { name: uniqueTable(`${owner.name}_${a.name}`), columns: [], node: a.node };
        addForeignKey(table, owner, '', true, `multi${a.node.id}`);
        addColumn(table, { name: a.name, pk: true });
        tables.push(table);
      }
    }

    // 4) Beziehungen
    for (const r of relationships) {
      const rName = cleanName(r.name, 'Beziehung');
      const ends = links(r).filter(l => l.other.type === 'entity');
      const attrs = attributesOf(r);
      if (r.weak) {
        // identifizierende Beziehung: bereits in der schwachen Entity aufgegangen
        const weak = ends.map(l => tableOf.get(l.other.id)).find(t => t.weak) || tableOf.get(ends[0]?.other.id);
        if (weak) for (const a of attrs) addColumn(weak, { name: a.name, pk: false });
        continue;
      }
      if (ends.length < 2) {
        warnings.push(`Beziehung „${rName}“ verbindet weniger als zwei Entities und wird übersprungen.`);
        continue;
      }
      const recursive = new Set(ends.map(l => l.other.id)).size < ends.length;
      const prefixFor = (l, i) => (l.edge.role ? l.edge.role.trim() : recursive ? `${rName}_${i + 1}` : '');
      for (const l of ends) {
        if (!cardinality(l.edge.label)) {
          warnings.push(`Kardinalität an „${rName}“ – „${cleanName(l.other.name, '?')}“ fehlt; als „viele“ angenommen.`);
        }
      }

      if (ends.length === 2) {
        const [x, y] = ends;
        const xOne = refersToOne(x.edge, y.edge);
        const yOne = refersToOne(y.edge, x.edge);
        let holder = null;
        if (xOne && yOne) holder = mandatory(y.edge) && !mandatory(x.edge) ? y : x;  // 1:1
        else if (xOne) holder = x;
        else if (yOne) holder = y;
        if (holder) {
          const target = holder === x ? y : x;
          const table = tableOf.get(holder.other.id);
          const prefix = target.edge.role ? target.edge.role.trim() : recursive ? rName : '';
          addForeignKey(table, tableOf.get(target.other.id), prefix, false, `rel${r.id}`);
          for (const a of attrs) addColumn(table, { name: a.name, pk: false });
          continue;
        }
      }

      // N:M bzw. mehrstellig: eigene Tabelle
      const table = { name: uniqueTable(rName), columns: [], node: r };
      ends.forEach((l, i) => addForeignKey(table, tableOf.get(l.other.id), prefixFor(l, i), true, `rel${r.id}_${i}`));
      for (const a of attrs) addColumn(table, { name: a.name, pk: a.key });
      tables.push(table);
    }

    return { tables, warnings: [...new Set(warnings)] };
  }

  // Textdarstellung: Student(_MatrNr_, Name, ↑KursNr)
  function toText(result) {
    return result.tables.map(t => `${t.name}(${t.columns.map(c => (c.fk ? '↑' : '') + (c.pk ? `_${c.name}_` : c.name)).join(', ')})`).join('\n');
  }

  function toHTML(result, escape) {
    return result.tables.map(t => `<div class="relation"><b>${escape(t.name)}</b>(${t.columns.map(c => {
      let s = escape(c.name);
      if (c.pk) s = `<u>${s}</u>`;
      if (c.fk) s = `<span class="fk" title="Fremdschlüssel auf ${escape(c.fk.table)}">↑${s}</span>`;
      return s;
    }).join(', ')})</div>`).join('');
  }

  const quote = name => `"${String(name).replace(/"/g, '""')}"`;

  function toSQL(result, title) {
    const lines = [`-- Erzeugt mit ER-Editor${title ? ` aus „${title}“` : ''}. Datentypen bitte prüfen und anpassen.`, ''];
    for (const t of result.tables) {
      const cols = t.columns.map(c => `  ${quote(c.name)} ${c.type}${c.pk ? ' NOT NULL' : ''}`);
      const pk = t.columns.filter(c => c.pk).map(c => quote(c.name));
      if (pk.length) cols.push(`  PRIMARY KEY (${pk.join(', ')})`);
      lines.push(`CREATE TABLE ${quote(t.name)} (`, cols.join(',\n'), ');', '');
    }
    // Fremdschlüssel zum Schluss – so spielen Reihenfolge und Zyklen keine Rolle
    for (const t of result.tables) {
      const groups = new Map();
      for (const c of t.columns) if (c.fk) {
        const key = c.fk.group + '|' + c.fk.table;
        if (!groups.has(key)) groups.set(key, { table: c.fk.table, cols: [], refs: [] });
        groups.get(key).cols.push(quote(c.name));
        groups.get(key).refs.push(quote(c.fk.column));
      }
      for (const g of groups.values()) {
        lines.push(`ALTER TABLE ${quote(t.name)} ADD FOREIGN KEY (${g.cols.join(', ')}) REFERENCES ${quote(g.table)} (${g.refs.join(', ')});`);
      }
    }
    return lines.join('\n').trim() + '\n';
  }

  const api = { derive, toText, toHTML, toSQL, cardinality };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ERRelational = api;
})(typeof window !== 'undefined' ? window : globalThis);
