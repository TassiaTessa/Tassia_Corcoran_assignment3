document.addEventListener('DOMContentLoaded', function () {
    generateCartRows();
    addPurchaseButton(); // Add the purchase button initially
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

    // If no items in the cart, display a message and a back to products button
    if (cart.length === 0) {
        let row = table.insertRow();
        let cell = row.insertCell(0);
        cell.colSpan = 6;
        cell.innerHTML = "No items in the cart.";

        // Add a back to products button
        let backButton = document.createElement("button");
        backButton.textContent = "Back to Products";
        backButton.classList.add("back-button");

        // Add an event listener to handle the click event
        backButton.addEventListener("click", function () {
            // Redirect to products_display.html
            window.location.href = "/products_display.html";
        });

        // Append the button to the body
        document.body.appendChild(backButton);

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
        <th> </th>
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

        // Add a remove button
        let removeButton = document.createElement("button");
        removeButton.textContent = "Remove From Cart";
        removeButton.classList.add("remove-button");

        // Add an event listener to handle the click event
        removeButton.addEventListener("click", function () {
            removeCartItem(i);
        });

        // Append the button to the row
        row.insertCell(5).appendChild(removeButton);
    }

    // Calculate total price for all items in the cart
    let totalPrice = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);

    // Display the total in the HTML
    displayTotal(totalPrice);
}

// Function to display the total
function displayTotal(total) {
    // Display the total in the HTML
    let totalCell = document.getElementById("total-cell");
    totalCell.innerHTML = `Your Total Is: $${total.toFixed(2)}`;
}
function addPurchaseButton() {
    // Check if the purchase button already exists
    if (!document.getElementById("purchaseButton")) {
        // Create a button element
        let purchaseButton = document.createElement("button");
        purchaseButton.textContent = "Checkout";
        purchaseButton.id = "purchaseButton"; // Assign an ID to the button

        // Add a class to the button
        purchaseButton.classList.add("checkout-button");

        // Add an event listener to handle the click event
        purchaseButton.addEventListener("click", function () {
            // Check if the user is authenticated
            fetch('/get_cart') // Assuming you have a route to get cart data
                .then(response => response.json())
                .then(cart => {
                    if (cart.length > 0) {
                        // Check authentication status on the server
                        fetch('/check_authentication')
                            .then(response => response.json())
                            .then(authenticationStatus => {
                                if (authenticationStatus.isAuthenticated) {
                                    // Redirect to invoice.html if authenticated
                                    window.location.href = "/invoice.html";
                                } else {
                                    // Redirect to login.html if not authenticated
                                    window.location.href = "/login.html";
                                }
                            })
                            .catch(error => console.error('Error checking authentication:', error));
                    }
                })
                .catch(error => console.error('Error getting cart data:', error));
        });

        // Append the button to the body
        document.body.appendChild(purchaseButton);
    }
}

// Function to remove a cart item
function removeCartItem(index) {
    console.log("Index:", index);

    // Retrieve cart information from cookies
    let cart = [];
    for (let i in products) {
        let qty = Cookies.get(`product_${i}`);
        if (qty > 0) {
            cart.push({ product: products[i], quantity: parseInt(qty) });
        }
    }
    console.log("Cart before removal:", cart);

    // Update quantity or remove the item
    if (cart[index].quantity > 1) {
        cart[index].quantity -= 1;
    } else {
        cart.splice(index, 1);
    }
    console.log("Cart after removal:", cart);

    // Update cookies
    updateCartCookies(cart);

    // Regenerate the cart rows
    generateCartRows();
}

// Function to update cart information in cookies
function updateCartCookies(cart) {
    // Clear existing cart cookies
    for (let i in products) {
        Cookies.remove(`product_${i}`);
    }

    // Update cookies with new cart information
    for (let i = 0; i < cart.length; i++) {
        let cartItem = cart[i];
        Cookies.set(`product_${cartItem.product.id}`, cartItem.quantity);
    }
}
