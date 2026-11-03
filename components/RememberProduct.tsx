"use client";

import { useEffect } from "react";
import { LAST_PRODUCT_COOKIE, type Product } from "@/lib/landingRule";

/** Notes which product this browser last used, so the next sign-in returns there. */
export function RememberProduct({ product }: { product: Product }) {
  useEffect(() => {
    document.cookie = `${LAST_PRODUCT_COOKIE}=${product}; path=/; max-age=31536000; samesite=lax`;
  }, [product]);
  return null;
}
