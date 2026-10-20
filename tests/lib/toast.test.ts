import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_DURATION, currentToasts, dismissToast, toast } from "@/lib/toast";

beforeEach(() => currentToasts().forEach((item) => dismissToast(item.id)));

describe("toasts", () => {
  it("keeps errors until dismissed and times the rest", () => {
    toast.error("Couldn't save the file");
    toast.success("Downloaded plan.png");
    const [error, success] = currentToasts();
    expect(error.duration).toBe(0);
    expect(success.duration).toBe(DEFAULT_DURATION.success);
  });

  it("replaces a repeat of the same message instead of stacking it", () => {
    toast.error("Couldn't save the file");
    toast.error("Couldn't save the file");
    expect(currentToasts()).toHaveLength(1);
  });

  it("shows at most three, dropping the oldest", () => {
    ["One", "Two", "Three", "Four"].forEach((title) => toast.info(title));
    expect(currentToasts().map((item) => item.title)).toEqual(["Two", "Three", "Four"]);
  });

  it("treats an empty details list as none", () => {
    toast.warning("Opened with repairs", { details: [] });
    expect(currentToasts()[0].details).toBeUndefined();
  });
});
