"""A small module written the way a professional would write it.

DRIPS uses this file as the "north star" when it explains the difference between
code that merely works and code a team can maintain.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

logger = logging.getLogger(__name__)

TAX_RATE = Decimal("0.20")
FREE_SHIPPING_THRESHOLD = Decimal("50.00")
CENT = Decimal("0.01")


@dataclass(frozen=True, slots=True)
class LineItem:
    """One row of a shopping cart."""

    sku: str
    unit_price: Decimal
    quantity: int

    @property
    def line_total(self) -> Decimal:
        return (self.unit_price * self.quantity).quantize(CENT, rounding=ROUND_HALF_UP)


def cart_subtotal(items: list[LineItem]) -> Decimal:
    """Sum every line item, rounded once at the end."""
    total = sum((item.line_total for item in items), start=Decimal("0"))
    return total.quantize(CENT, rounding=ROUND_HALF_UP)


def apply_percentage_discount(subtotal: Decimal, percent: Decimal | int | None) -> Decimal:
    """Return ``subtotal`` reduced by ``percent`` (0-100).

    ``None`` means "no discount" and is treated as 0, which is clearer than
    falling back to a default argument that callers cannot see.
    """
    if percent is None:
        return subtotal
    if not 0 <= Decimal(percent) <= 100:
        raise ValueError(f"discount must be between 0 and 100, got {percent}")
    multiplier = Decimal(1) - Decimal(percent) / Decimal(100)
    return (subtotal * multiplier).quantize(CENT, rounding=ROUND_HALF_UP)


def grand_total(items: list[LineItem], discount_percent: Decimal | int | None = None) -> Decimal:
    """Subtotal, discount and tax, in that order."""
    discounted = apply_percentage_discount(cart_subtotal(items), discount_percent)
    return (discounted * (Decimal(1) + TAX_RATE)).quantize(CENT, rounding=ROUND_HALF_UP)


def qualifies_for_free_shipping(subtotal: Decimal) -> bool:
    return subtotal >= FREE_SHIPPING_THRESHOLD


def load_items(path: Path) -> list[LineItem]:
    """Read line items from a JSON file.

    Raises:
        FileNotFoundError: the cart file does not exist.
        ValueError: the JSON payload is not a list of line items.
    """
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"expected a list of items in {path}, got {type(payload).__name__}")
    return [
        LineItem(
            sku=str(entry["sku"]),
            unit_price=Decimal(str(entry["unit_price"])),
            quantity=int(entry["quantity"]),
        )
        for entry in payload
    ]


def checkout_summary(items: list[LineItem], discount_percent: Decimal | int | None = None) -> dict[str, str]:
    """Human-readable summary used by the CLI and by tests."""
    subtotal = cart_subtotal(items)
    total = grand_total(items, discount_percent)
    return {
        "items": str(len(items)),
        "subtotal": f"{subtotal:.2f}",
        "total": f"{total:.2f}",
        "free_shipping": "yes" if qualifies_for_free_shipping(subtotal) else "no",
    }
