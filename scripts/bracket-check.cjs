// quick bracket counter for ide.jsx
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "apps", "desktop", "src", "ide.jsx"), "utf8");
let code = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
code = code
  .replace(/"[^"]*"/g, '""')
  .replace(/'[^']*'/g, "''")
  .replace(/`[^`]*`/g, "``");
let p = 0, b = 0, c = 0;
let line = 1, col = 0;
let firstMismatch = null;
for (let i = 0; i < code.length; i++) {
  col++;
  if (code[i] === "\n") { line++; col = 0; }
  if (code[i] === "(") p++;
  else if (code[i] === ")") { p--; if (p < 0 && !firstMismatch) firstMismatch = ["UNMATCHED )", line, col]; }
  else if (code[i] === "{") b++;
  else if (code[i] === "}") { b--; if (b < 0 && !firstMismatch) firstMismatch = ["UNMATCHED }", line, col]; }
  else if (code[i] === "[") c++;
  else if (code[i] === "]") { c--; if (c < 0 && !firstMismatch) firstMismatch = ["UNMATCHED ]", line, col]; }
}
console.log("final balances: ()=" + p + " {}=" + b + " []=" + c);
if (firstMismatch) console.log("first mismatch:", firstMismatch);
else console.log("no single-char mismatch — look for </div> / </span> / paren in JSX expressions before line", 1064);
