document.addEventListener('DOMContentLoaded', function () {
    generateInvoice();
        // Trigger the email sending when the page loads
        sendInvoiceEmail();
    });

    function sendInvoiceEmail() {
        // Make an AJAX request to the server to send the email
        fetch('/send_invoice_email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        })
            .then(response => response.text())
            .then(data => console.log(data))
            .catch(error => console.error('Error sending email:', error));
    }
function generateInvoice() {
    // Get the container
    let invoiceContainer = document.getElementById("invoice-content");

    // Clear the content
    invoiceContainer.innerHTML = '';

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
        invoiceContainer.innerHTML = "No items in the cart.";
        return;
    }

    // Loop through the products in the cart
    for (let i = 0; i < cart.length; i++) {
        let cartItem = cart[i];

        // Create a container for each product section
        let itemContainer = document.createElement("div");
        itemContainer.classList.add("invoice-section");

        // Add the item to the invoice container
        itemContainer.innerHTML = `
        <div class="product-row">
            <img src="${cartItem.product.image}" alt="${cartItem.product.name}" class="img-small">
            <div id="product-name">
                <p><strong>Product:</strong>    ${cartItem.product.name}</p>
                <p><strong>Quantity:</strong>   ${cartItem.quantity}</p>
                <p><strong>Price:</strong> $    ${cartItem.product.price.toFixed(2)}</p>
                <p><strong>Total:</strong> $   <b> ${(cartItem.product.price * cartItem.quantity).toFixed(2)}</p></b>
            </div>
        </div>
    `;

        // Append the itemContainer to the invoice container
        invoiceContainer.appendChild(itemContainer);
    }

    // Calculate subtotal
    let subtotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);

    // Display subtotal in the invoice
    let subtotalDiv = document.createElement("div");
    subtotalDiv.classList.add("invoice-summary");
    subtotalDiv.innerHTML = `<p><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>`;
    invoiceContainer.appendChild(subtotalDiv);

    // Calculate tax
    let taxRate = 0.047; // 4.7%
    let taxAmount = subtotal * taxRate;

    // Display tax in the invoice
    let taxDiv = document.createElement("div");
    taxDiv.classList.add("invoice-summary");
    taxDiv.innerHTML = `<p><strong>Tax:</strong> $${taxAmount.toFixed(2)}</p>`;
    invoiceContainer.appendChild(taxDiv);

    // Calculate shipping
    let shipping;
    if (subtotal < 300) {
        shipping = 20;
    } else if (subtotal >= 300 && subtotal < 600) {
        shipping = 40;
    } else {
        shipping = 0;
    }

    // Display shipping in the invoice
    let shippingDiv = document.createElement("div");
    shippingDiv.classList.add("invoice-summary");
    shippingDiv.innerHTML = `<p><strong>Shipping:</strong> $${shipping.toFixed(2)}</p>`;
    invoiceContainer.appendChild(shippingDiv);

    // Calculate total
    let total = subtotal + taxAmount + shipping;

    // Display total in the invoice
    let totalDiv = document.createElement("div");
    totalDiv.classList.add("invoice-summary");
    totalDiv.innerHTML = `<p><b><strong>Total: $${total.toFixed(2)}</p></b></strong>`;
    invoiceContainer.appendChild(totalDiv);
}
