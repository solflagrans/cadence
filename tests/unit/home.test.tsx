// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Home from "@/app/page";

it("opens the month preview without cloud settings", async () => {
  render(<Home />);
  expect(await screen.findByRole("heading", { name: "Пока нет приоритетов" })).toBeInTheDocument();
  expect(screen.getByText("Демо · до перезагрузки")).toBeInTheDocument();
});
