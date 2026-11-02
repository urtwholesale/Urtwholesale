// scripts/audit_database_security.js
// Automated Static Security & Penetration Analyzer for PostgreSQL Migrations & RLS Policies

import fs from "fs";
import path from "path";

const migrationsDir = path.resolve("supabase/migrations");
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && !f.includes("rollback"))
  .sort();

console.log(`\n============================================================`);
console.log(`URT WHOLESALE - AUTOMATED DATABASE RLS & SECURITY AUDIT`);
console.log(`Analyzing ${files.length} migration files in ${migrationsDir}`);
console.log(`============================================================\n`);

const findings = [];
const tables = new Map();
const functions = new Map();
const views = new Map();

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");

  // 1. Detect Tables & RLS enabling
  const tableMatches = content.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi);
  for (const m of tableMatches) {
    const tableName = m[1].toLowerCase();
    if (!tables.has(tableName)) {
      tables.set(tableName, { name: tableName, rls: false, file, policies: [] });
    }
  }

  const rlsMatches = content.matchAll(/alter\s+table\s+(?:public\.)?([a-zA-Z0-9_]+)\s+enable\s+row\s+level\s+security/gi);
  for (const m of rlsMatches) {
    const tableName = m[1].toLowerCase();
    if (tables.has(tableName)) {
      tables.get(tableName).rls = true;
    } else {
      tables.set(tableName, { name: tableName, rls: true, file, policies: [] });
    }
  }

  // 2. Detect Policies
  const policyMatches = content.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?([a-zA-Z0-9_]+)(?:[^;]*?)(?:for\s+([a-zA-Z]+))?(?:[^;]*?)(?:using\s*\(([^;]*?)\))?(?:[^;]*?)(?:with\s+check\s*\(([^;]*?)\))?;/gis);
  for (const m of policyMatches) {
    const policyName = m[1];
    const tableName = m[2].toLowerCase();
    const cmd = (m[3] || "all").toUpperCase();
    const qual = m[4] ? m[4].trim() : null;
    const withCheck = m[5] ? m[5].trim() : null;

    if (tables.has(tableName)) {
      tables.get(tableName).policies.push({ policyName, cmd, qual, withCheck, file });
    }
  }

  // 3. Detect Functions & Security Definer & search_path
  const funcMatches = content.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)/gi);
  for (const m of funcMatches) {
    const funcName = m[1].toLowerCase();
    const args = m[2].trim();
    // Search within the function block
    const funcIndex = m.index;
    const snippet = content.substring(funcIndex, funcIndex + 1200);

    const isSecDefiner = /security\s+definer/i.test(snippet);
    const hasSearchPath = /set\s+search_path\s*=/i.test(snippet);
    const hasAdminCheck = /is_admin\(\)/i.test(snippet);

    functions.set(`${funcName}(${args})`, {
      name: funcName,
      args,
      isSecDefiner,
      hasSearchPath,
      hasAdminCheck,
      file,
    });
  }

  // 4. Detect Views
  const viewMatches = content.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-zA-Z0-9_]+)(?:[^;]*?)as\s+select/gis);
  for (const m of viewMatches) {
    const viewName = m[1].toLowerCase();
    const snippet = m[0];
    const hasSecurityInvoker = /security_invoker\s*=\s*(?:true|on)/i.test(snippet);
    views.set(viewName, { name: viewName, hasSecurityInvoker, file });
  }
}

// -------------------------------------------------------------
// AUDIT CHECKS
// -------------------------------------------------------------

// Check 1: Tables without RLS enabled
for (const [name, info] of tables.entries()) {
  if (!info.rls) {
    findings.push({
      id: "RLS-01",
      severity: "CRITICAL",
      component: `table:${name}`,
      description: `Table '${name}' was created in ${info.file} without 'ENABLE ROW LEVEL SECURITY'.`,
    });
  }
}

// Check 2: Wide open insert policies
for (const [name, info] of tables.entries()) {
  for (const p of info.policies) {
    if (p.withCheck && p.withCheck === "true" && name !== "search_logs") {
      findings.push({
        id: "RLS-02",
        severity: name === "orders" || name === "profiles" ? "CRITICAL" : "MEDIUM",
        component: `table:${name} policy:${p.policyName}`,
        description: `Policy '${p.policyName}' on '${name}' has unrestricted 'WITH CHECK (true)' in ${p.file}.`,
      });
    }
  }
}

// Check 3: Security Definer functions without pinned search_path
for (const [sig, info] of functions.entries()) {
  if (info.isSecDefiner && !info.hasSearchPath) {
    findings.push({
      id: "SEC-DEF-01",
      severity: "MEDIUM",
      component: `function:${info.name}`,
      description: `SECURITY DEFINER function '${info.name}' in ${info.file} does not explicitly pin 'SET search_path'.`,
    });
  }
}

// Check 4: Views without security_invoker
for (const [name, info] of views.entries()) {
  if (!info.hasSecurityInvoker && name !== "products_admin") {
    findings.push({
      id: "VIEW-01",
      severity: "HIGH",
      component: `view:${name}`,
      description: `View '${name}' in ${info.file} was defined without 'WITH (security_invoker = true)' (executes as view owner).`,
    });
  }
}

// Print Results
console.log(`[+] Discovered ${tables.size} tables, ${functions.size} functions, ${views.size} views.\n`);

console.log(`------------------------------------------------------------`);
console.log(`SECURITY AUDIT SCORECARD`);
console.log(`------------------------------------------------------------`);

if (findings.length === 0) {
  console.log(`[PASS] Zero security policy anomalies detected across migrations!\n`);
} else {
  console.log(`Identified ${findings.length} security items to review:\n`);
  findings.forEach((f, idx) => {
    console.log(`[${idx + 1}] [${f.severity}] ${f.id} - ${f.component}`);
    console.log(`    ${f.description}`);
  });
}

console.log(`\n============================================================`);
console.log(`TABLE RLS STATUS SUMMARY`);
console.log(`============================================================`);
for (const [name, info] of tables.entries()) {
  const status = info.rls ? "ENABLED " : "DISABLED";
  console.log(`  [${status}] public.${name.padEnd(26)} (${info.policies.length} policies registered)`);
}
console.log(`\nAudit complete.\n`);

