// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { expect, it } from "vitest";

import Home from "@/app/page";

it("keeps the initial page blank", () => {
  const { container } = render(<Home />);
  expect(container).toBeEmptyDOMElement();
});
