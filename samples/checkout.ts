// Checkout flow for the web store.
// Demo playground for DRIPS: safe to run, full of teachable problems.

type CartItem = { sku: string; price: number; qty: number };

const API_URL = "https://api.example.com/v1";

function subtotal(items: any) {
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total = total + items[i].price * items[i].qty;
  }
  return total;
}

function applyCoupon(total: number, coupon: string) {
  if (coupon == "SAVE10") {
    return total * 0.9;
  }
  if (coupon == "SAVE20") {
    return total * 0.8;
  }
  return total;
}

async function checkout(cart: CartItem[], coupon: string, user: string) {
  try {
    const total = applyCoupon(subtotal(cart), coupon);
    const response = await fetch(API_URL + "/orders", {
      method: "POST",
      body: JSON.stringify({ user: user, total: total }),
    });
    const data = response.json();
    console.log("order created", data);
    return data.id;
  } catch (error) {
    console.log(error);
  }
}

function formatPrice(value) {
  return "$" + value.toFixed(2);
}

function validateCart(cart) {
  if (cart.length = 0) {
    return false;
  }
  for (const item of cart) {
    if (item.qty > 0 && item.price > 0) {
      continue;
    } else {
      return false;
    }
  }
  return true;
}

export { subtotal, applyCoupon, checkout, formatPrice, validateCart };
