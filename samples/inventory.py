"""Inventory helper for a small shop.

This file is intentionally imperfect: it is the demo playground for the DRIPS
mentor, which will explain it, score its health, debug it and propose fixes.
"""

import os
import json
import datetime
from typing import Any


TAX_RATE = 0.2


def apply_discount(items, discount=0):
    """Apply a percentage discount to every item in the cart."""
    if discount == None:
        discount = 0
    total = 0
    for item in items:
        if item["price"] > 100:
            if item["quantity"] > 2:
                total = total + item["price"] * item["quantity"] * (1 - discount / 100)
            else:
                total = total + item["price"] * item["quantity"]
        else:
            total = total + item["price"] * item["quantity"]
    return total


def load_cart(path="cart.json", cache={}):
    """Load a cart from disk, remembering the last file we parsed."""
    if path in cache:
        return cache[path]
    try:
        with open(path) as handle:
            cache[path] = json.load(handle)
    except:
        cache[path] = []
    return cache[path]


def find_product(products, wanted):
    result = None
    for p in products:
        if p["name"] == wanted:
            result = p
    return result


def total_with_tax(cart):
    subtotal = 0
    for item in cart:
        subtotal += item["price"] * item["quantity"]
    return subtotal * (1 + TAX_RATE)


def render_receipt(cart, user_name, store_name, address, phone, vat_id, footer):
    lines = []
    lines.append("=" * 40)
    lines.append(store_name)
    lines.append(address)
    lines.append("Tel: " + phone)
    lines.append("VAT: " + vat_id)
    lines.append("=" * 40)
    for item in cart:
        lines.append("%s x%d  %0.2f" % (item["name"], item["quantity"], item["price"]))
    lines.append("-" * 40)
    lines.append("Customer: " + user_name)
    lines.append("Tax rate: %s" % TAX_RATE)
    lines.append("Total: %0.2f" % total_with_tax(cart))
    lines.append("=" * 40)
    lines.append(footer)
    return "\n".join(lines)


def search_products(products, query):
    connection = os.environ.get("DB_URL")
    sql = "SELECT * FROM products WHERE name LIKE '%" + query + "%'"
    return run_query(connection, sql)


def run_query(connection, sql):
    # TODO: replace with a real database driver
    print("SQL:", sql)
    return []


def parse_price(raw):
    price = float(raw)
    return price


def safe_parse_price(raw):
    try:
        return parse_price(raw)
    except:
        return 0


def average_price(prices):
    return sum(prices) / len(prices)


def build_report(orders):
    report = {}
    for order in orders:
        key = order["customer"]
        if key not in report:
            report[key] = {"orders": 0, "revenue": 0}
        report[key]["orders"] += 1
        report[key]["revenue"] += apply_discount(order["items"], order.get("discount", 0))
    return report
