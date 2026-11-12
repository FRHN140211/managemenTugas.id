export function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let index = 0;
  let dollarTag = null;
  let blockCommentDepth = 0;

  while (index < sql.length) {
    const character = sql[index];
    const next = sql[index + 1];

    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
      } else {
        current += character;
        index += 1;
      }
      continue;
    }

    if (blockCommentDepth > 0) {
      if (character === '/' && next === '*') {
        current += '/*';
        index += 2;
        blockCommentDepth += 1;
      } else if (character === '*' && next === '/') {
        current += '*/';
        index += 2;
        blockCommentDepth -= 1;
      } else {
        current += character;
        index += 1;
      }
      continue;
    }

    if (character === '-' && next === '-') {
      const end = sql.indexOf('\n', index);
      if (end === -1) break;
      current += '\n';
      index = end + 1;
      continue;
    }

    if (character === '/' && next === '*') {
      current += '/*';
      index += 2;
      blockCommentDepth = 1;
      continue;
    }

    if (character === "'" || character === '"') {
      const quote = character;
      current += character;
      index += 1;
      let closed = false;
      while (index < sql.length) {
        current += sql[index];
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) {
            current += sql[index + 1];
            index += 2;
            continue;
          }
          index += 1;
          closed = true;
          break;
        }
        index += 1;
      }
      if (!closed) throw new Error('Unterminated quoted value in SQL script.');
      continue;
    }

    if (character === '$') {
      const match = /^\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/.exec(sql.slice(index));
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length;
        continue;
      }
    }

    if (character === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      index += 1;
      continue;
    }

    current += character;
    index += 1;
  }

  if (dollarTag) throw new Error(`Unterminated dollar-quoted block ${dollarTag}.`);
  if (blockCommentDepth > 0) throw new Error('Unterminated block comment in SQL script.');

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}
