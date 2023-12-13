//invoice.js

// Global variables
let subtotal = 0;
let taxAmount = 0;
let shipping = 0;
let total = 0;

// Function to generate the item rows
function generateItemRows() {
    // Get the table
    let table = document.getElementById("invoiceTable");

    // Clear the table
    table.innerHTML = '';

    // Retrieve order information from cookies
    var order = [];

    for (let i in products) {
        let qty = Cookies.get(`qty${i}`);
        if (qty > 0) {
            order.push({ product: products[i], quantity: qty });
        }
    }

    // If no items in the order, display a message
    if (order.length === 0) {
        let row = table.insertRow();
        row.insertCell(0).innerHTML = "No items in the order.";
        return;
    }

    // Loop through the products in the order
    for (let i = 0; i < order.length; i++) {
        let orderItem = order[i];

        // Update the variables
        let extendedPrice = orderItem.product.price * orderItem.quantity;
        subtotal += extendedPrice;

        // Add the item to the table
        let row = table.insertRow();
        row.insertCell(0).innerHTML = `<img src="${orderItem.product.image}" class="img-small" name="img" data-tooltip="${orderItem.product.description}">`;
        row.insertCell(1).innerHTML = orderItem.product.name;
        row.insertCell(2).innerHTML = orderItem.quantity;
        row.insertCell(3).innerHTML = "$" + orderItem.product.price.toFixed(2);
        row.insertCell(4).innerHTML = "$" + extendedPrice.toFixed(2);
    }

    // Calculate total, tax, and shipping
    calculateTotal();

    // Display the total in the HTML
    displayTotal();
}

function displayTotal() {
    // Display the total in the HTML
    let totalTable = document.getElementById("totalTable");
    totalTable.innerHTML = `
        <tr style="border-top: 2px solid black;">
            <td colspan="5" style="text-align:center;">Sub-total</td>
            <td>$${subtotal.toFixed(2)}</td>
        </tr>
        <tr>
            <td colspan="5" style="text-align:center;">Hawaii Sales Tax @ ${taxRate * 100}%</td>
            <td>$${taxAmount.toFixed(2)}</td>
        </tr>
        <tr>
            <td colspan="5" style="text-align:center;">Shipping</td>
            <td>${shipping === 0 ? 'FREE' : '$' + shipping.toFixed(2)}</td>
        </tr>
        <tr>
            <td colspan="5" style="text-align:center;"><b>Total</td>
            <td><b>$${total.toFixed(2)}</td>
        </tr>
    `;
}

// Use DOMContentLoaded event instead of window.onload
document.addEventListener("DOMContentLoaded", function () {
    generateItemRows();
});
