import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots, robotsFromStatus } from "../src/robots.js";

const TOKEN = "prijswacht";

describe("robots.txt", () => {
  const txt = `
# commentaar
User-agent: *
Disallow: /checkout
Disallow: /*?sort=
Allow: /checkout/help
Disallow: /p/geheim$

User-agent: BadBot
User-agent: prijswacht
Disallow: /alleen-voor-ons
`;
  const groups = parseRobots(txt);

  it("eigen groep gaat voor *", () => {
    expect(isAllowed(groups, TOKEN, "/alleen-voor-ons")).toBe(false);
    expect(isAllowed(groups, TOKEN, "/checkout")).toBe(true);
  });

  it("anderen vallen onder *", () => {
    const g = parseRobots("User-agent: *\nDisallow: /checkout\nAllow: /checkout/help\nDisallow: /*?sort=\nDisallow: /p/geheim$");
    expect(isAllowed(g, TOKEN, "/checkout/betalen")).toBe(false);
    expect(isAllowed(g, TOKEN, "/checkout/help")).toBe(true);
    expect(isAllowed(g, TOKEN, "/lijst?sort=prijs")).toBe(false);
    expect(isAllowed(g, TOKEN, "/p/geheim")).toBe(false);
    expect(isAllowed(g, TOKEN, "/p/geheim/meer")).toBe(true);
    expect(isAllowed(g, TOKEN, "/product/962722/x.html")).toBe(true);
  });

  it("allow wint bij gelijke lengte", () => {
    const g = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a");
    expect(isAllowed(g, TOKEN, "/a")).toBe(true);
  });

  it("lege Disallow staat alles toe", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:"), TOKEN, "/x")).toBe(true);
  });

  it("Disallow: / voor iedereen", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /"), TOKEN, "/dp/B0F2TT8Q7M")).toBe(false);
  });

  it("amazon-achtige regels laten /dp/ toe", () => {
    const g = parseRobots("User-agent: *\nDisallow: /dp/product-availability/\nDisallow: /gp/cart");
    expect(isAllowed(g, TOKEN, "/dp/B0F2TT8Q7M")).toBe(true);
  });

  it("status: 4xx = geen regels, 5xx = alles dicht", () => {
    expect(isAllowed(robotsFromStatus(403, ""), TOKEN, "/x")).toBe(true);
    expect(isAllowed(robotsFromStatus(404, ""), TOKEN, "/x")).toBe(true);
    expect(isAllowed(robotsFromStatus(503, ""), TOKEN, "/x")).toBe(false);
    expect(isAllowed(robotsFromStatus(599, ""), TOKEN, "/x")).toBe(false);
  });
});
