document.addEventListener('DOMContentLoaded', function () {
    generateCartRows();
});

// Function to generate the cart rows
function generateCartRows() {
    // Get the table
    let table = document.getElementById("cart-content");

    // Clear the table
    table.innerHTML = '';

    // Retrieve cart information from cookies
    let cart = [];
    for (let i in products) {
        let qty = Cookies.get(`product_${i}`);
        if (qty > 0) {
            cart.push({ product: products[i], quantity: parseInt(qty) });
        }
    }

    // If no items in the cart, display a message
    if (cart.length === 0) {
        let row = table.insertRow();
        let cell = row.insertCell(0);
        cell.colSpan = 5;
        cell.innerHTML = "No items in the cart.";
        return;
    }

    // Add header row
    let headerRow = table.insertRow();
    headerRow.innerHTML = `
        <th>Image</th>
        <th>Product</th>
        <th>Quantity</th>
        <th>Price</th>
        <th>Total</th>
    `;

    // Loop through the products in the cart
    for (let i = 0; i < cart.length; i++) {
        let cartItem = cart[i];

        // Add the item to the table
        let row = table.insertRow();
        row.insertCell(0).innerHTML = `<img src="${cartItem.product.image}" class="img-small" name="img" data-tooltip="${cartItem.product.description}">`;
        row.insertCell(1).innerHTML = cartItem.product.name;
        row.insertCell(2).innerHTML = cartItem.quantity;
        row.insertCell(3).innerHTML = "$" + cartItem.product.price.toFixed(2);
        row.insertCell(4).innerHTML = "$" + (cartItem.product.price * cartItem.quantity).toFixed(2);
    }

    // Calculate total price for all items in the cart
    let totalPrice = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);

    // Display the total in the HTML
    displayTotal(totalPrice);

    // Add a purchase button
    addPurchaseButton();
}

function displayTotal(total) {
    // Display the total in the HTML
    let totalCell = document.getElementById("total-cell");
    totalCell.innerHTML = `Your Total Is: $${total.toFixed(2)}`;
}

function addPurchaseButton() {
    // Create a button element
    let purchaseButton = document.createElement("button");
    purchaseButton.textContent = "Checkout";
    
    // Add a class to the button
    purchaseButton.classList.add("checkout-button");

    // Add an event listener to handle the click event
    purchaseButton.addEventListener("click", function () {
        // Redirect to invoice.html
        window.location.href = "/invoice.html";
    });

    // Append the button to the body
    document.body.appendChild(purchaseButton);
}
