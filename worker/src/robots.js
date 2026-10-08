// robots.txt volgens RFC 9309: groepen per user-agent, langste match wint, allow wint bij gelijkspel.

export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (current && value) current.rules.push({ allow: key === "allow", pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

export function isAllowed(groups, token, path) {
  const t = token.toLowerCase();
  let matching = groups.filter((g) => g.agents.some((a) => a !== "*" && t.includes(a)));
  if (!matching.length) matching = groups.filter((g) => g.agents.includes("*"));
  const rules = matching.flatMap((g) => g.rules);

  let best = null;
  for (const rule of rules) {
    if (!matches(rule.pattern, path)) continue;
    const len = rule.pattern.length;
    if (!best || len > best.len || (len === best.len && rule.allow && !best.allow)) {
      best = { len, allow: rule.allow };
    }
  }
  return best ? best.allow : true;
}

function matches(pattern, path) {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const regex = new RegExp("^" + re + (anchored ? "$" : ""));
  return regex.test(path) || regex.test(safeDecode(path));
}

function safeDecode(s) {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}

// Wat een HTTP-status van robots.txt betekent (RFC 9309, 2.3.1): 4xx = geen regels, 5xx of geen antwoord = alles dicht.
export function robotsFromStatus(status, body) {
  if (status >= 200 && status < 300) return parseRobots(body);
  if (status >= 400 && status < 500) return [];
  return [{ agents: ["*"], rules: [{ allow: false, pattern: "/" }] }];
}
