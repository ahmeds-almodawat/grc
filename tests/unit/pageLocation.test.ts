import { describe, expect, it, vi } from "vitest";
import {
  PAGE_LOCATION_REGISTRY,
  isCanonicalPageLocation,
  isPageKey,
  pageKeyFromLocation,
  pageKeyFromLocationValue,
  pageUrlForLocation,
  resolveAuthorizedPage,
  writePageLocation,
  type PageHistoryLike,
  type PageLocationLike,
} from "../../src/routes/pageLocation";

function location(
  search = "",
  pathname = "/",
  hash = "",
): PageLocationLike {
  return { pathname, search, hash };
}

function historySpies() {
  return {
    pushState: vi.fn(),
    replaceState: vi.fn(),
  } satisfies PageHistoryLike;
}

describe("typed page location registry", () => {
  it("provides a unique canonical URL value for every PageKey", () => {
    const keys = Object.keys(PAGE_LOCATION_REGISTRY);
    const values = Object.values(PAGE_LOCATION_REGISTRY);

    expect(keys.length).toBeGreaterThan(60);
    expect(new Set(values).size).toBe(values.length);
    expect(PAGE_LOCATION_REGISTRY.admin).toBe("admin");
    expect(PAGE_LOCATION_REGISTRY.departments).toBe("departments");
    expect(keys.every(isPageKey)).toBe(true);
  });

  it("parses canonical query values in both directions", () => {
    expect(pageKeyFromLocation(location("?page=admin"))).toBe("admin");
    expect(pageKeyFromLocation(location("?lang=ar&page=departments"))).toBe(
      "departments",
    );
    expect(pageKeyFromLocationValue("daily-operations")).toBe(
      "dailyOperationsHub",
    );
  });

  it("rejects unknown, empty, and duplicated page values", () => {
    expect(pageKeyFromLocation(location("?page=not-a-page"))).toBeNull();
    expect(pageKeyFromLocation(location("?page="))).toBeNull();
    expect(
      pageKeyFromLocation(location("?page=admin&page=departments")),
    ).toBeNull();
    expect(pageKeyFromLocationValue("Admin")).toBeNull();
  });

  it("supports historical pathname aliases when no page query is present", () => {
    expect(
      pageKeyFromLocation(
        location("?lang=en", "/production-operator-console/"),
      ),
    ).toBe("productionOperatorConsole");
    expect(
      pageKeyFromLocation(location("", "/production-evidence-closure")),
    ).toBe("productionEvidenceClosure");
    expect(pageKeyFromLocation(location("", "/"))).toBe("home");
  });

  it("gives the primary page query precedence over a pathname alias", () => {
    expect(
      pageKeyFromLocation(
        location("?page=departments", "/production-operator-console"),
      ),
    ).toBe("departments");
    expect(
      pageKeyFromLocation(
        location("?page=invalid", "/production-operator-console"),
      ),
    ).toBeNull();
  });
});

describe("page URL serialization", () => {
  it("writes the canonical page while preserving unrelated safe parameters", () => {
    const result = pageUrlForLocation(
      "admin",
      location("?lang=ar&theme=contrast&page=home", "/"),
    );
    const resultUrl = new URL(result, "https://grc.example");

    expect(resultUrl.pathname).toBe("/");
    expect(resultUrl.searchParams.get("page")).toBe("admin");
    expect(resultUrl.searchParams.get("lang")).toBe("ar");
    expect(resultUrl.searchParams.get("theme")).toBe("contrast");
    expect(resultUrl.searchParams.getAll("page")).toEqual(["admin"]);
  });

  it("does not carry credential, identity, workbook, or session values forward", () => {
    const result = pageUrlForLocation(
      "departments",
      location(
        "?lang=en&access_token=jwt&password=secret&user_id=123&employeeId=456&workbook_file=xlsx&confirmation=IMPORT",
        "/",
        "#access_token=jwt",
      ),
    );
    const resultUrl = new URL(result, "https://grc.example");

    expect(resultUrl.searchParams.get("lang")).toBe("en");
    expect(resultUrl.searchParams.get("page")).toBe("departments");
    expect(resultUrl.searchParams.has("access_token")).toBe(false);
    expect(resultUrl.searchParams.has("password")).toBe(false);
    expect(resultUrl.searchParams.has("user_id")).toBe(false);
    expect(resultUrl.searchParams.has("employeeId")).toBe(false);
    expect(resultUrl.searchParams.has("workbook_file")).toBe(false);
    expect(resultUrl.searchParams.has("confirmation")).toBe(false);
    expect(resultUrl.hash).toBe("");
  });

  it("does not treat a page URL containing sensitive material as canonical", () => {
    const unsafeLocation = location(
      "?campaign=patch83v&page=admin&password=secret",
      "/",
      "#user/4dcfd619-8fc3-40e1-88cb-58f7af7158e6",
    );

    expect(isCanonicalPageLocation(unsafeLocation, "admin")).toBe(false);
    expect(pageUrlForLocation("admin", unsafeLocation)).toBe(
      "/?campaign=patch83v&page=admin",
    );
  });

  it("uses pushState for normal navigation and replaceState for corrections", () => {
    const pushHistory = historySpies();
    const replaceHistory = historySpies();
    const currentLocation = location("?lang=en&page=home");

    expect(
      writePageLocation(
        "departments",
        { mode: "push" },
        { location: currentLocation, history: pushHistory },
      ),
    ).toBe("/?lang=en&page=departments");
    expect(pushHistory.pushState).toHaveBeenCalledWith(
      null,
      "",
      "/?lang=en&page=departments",
    );
    expect(pushHistory.replaceState).not.toHaveBeenCalled();

    writePageLocation(
      "admin",
      { mode: "replace" },
      { location: currentLocation, history: replaceHistory },
    );
    expect(replaceHistory.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/?lang=en&page=admin",
    );
    expect(replaceHistory.pushState).not.toHaveBeenCalled();
  });

  it("does not create a duplicate history entry for the current canonical page", () => {
    const history = historySpies();
    const currentLocation = location("?lang=en&page=admin");

    expect(
      writePageLocation(
        "admin",
        { mode: "push" },
        { location: currentLocation, history },
      ),
    ).toBe("/?lang=en&page=admin");
    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(isCanonicalPageLocation(currentLocation, "admin")).toBe(true);
  });

  it("rejects an invalid runtime navigation candidate without writing history", () => {
    const history = historySpies();
    expect(
      writePageLocation(
        "not-a-page",
        {},
        { location: location(), history },
      ),
    ).toBeNull();
    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
  });
});

describe("authorized page restoration", () => {
  const canAccess = (page: string) =>
    page === "home" || page === "departments";

  it("restores an authorized requested page without replacing it", () => {
    expect(
      resolveAuthorizedPage("departments", canAccess, "home"),
    ).toEqual({
      page: "departments",
      shouldReplace: false,
      reason: "allowed",
    });
  });

  it("replaces an unauthorized deep link with the first allowed page", () => {
    expect(resolveAuthorizedPage("admin", canAccess, "departments")).toEqual({
      page: "departments",
      shouldReplace: true,
      reason: "unauthorized",
    });
  });

  it("replaces an invalid requested page with the first allowed page", () => {
    expect(resolveAuthorizedPage(null, canAccess, "departments")).toEqual({
      page: "departments",
      shouldReplace: true,
      reason: "invalid",
    });
  });
});
