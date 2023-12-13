// Importing modules
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const qs = require('querystring');

// Create Express application
const app = express();
app.use(express.urlencoded({ extended: true }));

const cookieParser = require('cookie-parser');
app.use(cookieParser());

const session = require('express-session');
app.use(session({ secret: "MySecretKey", resave: true, saveUninitialized: true }));

// Middleware for logging cookies
app.use((req, res, next) => {
    // Log information about cookies
    console.log('Cookies:', req.cookies);

    // Continue to the next middleware in the stack
    next();
});

// Middleware for all routes
app.all('*', function (request, response, next) {
    //console.log(request.method + ' to ' + request.path);
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(__dirname + '/public'));

// Start the server on port 8080
app.listen(8080, () => console.log(`Listening on port 8080`));

// Load product data from JSON file
let products = require(__dirname + '/products.json');
// Initialize qty_sold for each product if it's not present
products.forEach(product => {
    if (!product.qty_sold) {
        product.qty_sold = 0;
    }
});

// Route for handling GET request to "/products.js"
app.get("/products.js", function (request, response, next) {
    response.type('.js');
    let products_str = `var products = ${JSON.stringify(products)};`;
    response.send(products_str);
});

// Middleware for handling URL-encoded data
app.use(express.urlencoded({ extended: true }));

// Function to validate quantity
function validateQuantity(quantity, availableQuantity) {
    let errors = [];
    quantity = Number(quantity);

    switch (true) {
        case isNaN(quantity) || quantity === '':
            errors.push("Not a number. Please enter non-negative quantity");
            break;
        case quantity < 0 && !Number.isInteger(quantity):
            errors.push("Not an integer. Please enter non-negative quantity");
            break;
        case quantity < 0:
            errors.push("Negative quantity. Please enter non-negative quantity");
            break;
        case quantity > availableQuantity:
            errors.push("Not enough items in stock");
            break;
    }
    return errors;
}

// User data initialization
let user_data;
const filename = __dirname + '/user_data.json';

if (fs.existsSync(filename)) {
    let data = fs.readFileSync(filename, 'utf8');
    user_data = JSON.parse(data);
    console.log(user_data);
} else {
    console.log(`${filename} does not exist`);
    user_data = {};
}

// Temporary variable for user inputs
let temp_user = {};
/// Process purchase form
app.post("/process_purchase", function (request, response) {
    let POST = request.body;
    console.log("Received form data:", POST);
    let has_qty = false;
    let errorObject = {};

    // Clear existing product-related cookies
    for (let i in products) {
        response.clearCookie(`qty${i}`);
    }

    // Log all cookies before setting new ones
    console.log('All Cookies before setting:', request.cookies);

    for (let i in products) {
        let qty = POST[`qty${i}`];
        has_qty = has_qty || (qty > 0);

        let errorMessage = validateQuantity(qty, products[i].quantity_available);

        if (errorMessage.length > 0) {
            errorObject[`qty${i}_error`] = errorMessage.join(', ');
        } else {
            // Set the quantity as a cookie
            response.cookie(`qty${i}`, qty);
            console.log(`Cookie qty${i} set to`, qty);
        }
    }

    // Set a cookie to track selected items
    response.cookie('selectedItems', JSON.stringify(POST));

    console.log('All Cookies after setting:', request.cookies);


    // After processing purchase
    if (has_qty == false && Object.keys(errorObject).length == 0) {
        console.log("Redirecting to products_display.html with error");
        response.redirect("./products_display.html?error");
    } else if (has_qty == true && Object.keys(errorObject).length == 0) {
        for (let i in products) {
            temp_user[`qty${[i]}`] = POST[`qty${[i]}`];
        }

        let params = new URLSearchParams(Object.entries(temp_user).filter(([key, value]) => value !== undefined));
        console.log("Redirecting to login.html with params");
        response.redirect(`./login.html?${params.toString()}`);

    } else if (Object.keys(errorObject).length > 0) {
        console.log("Redirecting to products_display.html with inputError");
        response.redirect("./products_display.html?" + qs.stringify(POST) + `&inputError`);
    } else {
        if (has_qty == false) {
            console.log("Redirecting to products_display.html with error");
            response.redirect("./products_display.html?" + qs.stringify(POST) + `&error`);
        }
    }
});

// Process login form
app.post('/process_login', (request, response) => {
    let POST = request.body;
    let entered_email = POST['email'].toLowerCase();
    let entered_password = POST['password'];

    if (entered_email.length == 0 && entered_password.length == 0) {
        response.query.loginError = 'Please enter email and password';
        response.redirect(`./login.html?${qs.stringify(request.query)}`);
        return;
    }

    if (user_data[entered_email]) {
        const [storedSalt, storedHash] = user_data[entered_email].password.split(':');
        const enteredHash = crypto.pbkdf2Sync(entered_password, storedSalt, 10000, 512, 'sha256').toString('hex');
        if (enteredHash === storedHash) {
            temp_user['email'] = entered_email;
            temp_user['name'] = user_data[entered_email].name;

            // Retrieve selected items from the cookie
            let selectedItemsCookie = request.cookies['selectedItems'];
            let selectedItems = selectedItemsCookie ? JSON.parse(selectedItemsCookie) : {};

            // Add the selected product information to temp_user
            for (let i in products) {
                temp_user[`qty${[i]}`] = selectedItems[`qty${[i]}`] || 0;  // Set to 0 if undefined
            }

            // Redirect to the invoice page with the updated temp_user data
            let params = new URLSearchParams();
            for (let i in products) {
                params.set(`qty${i}`, temp_user[`qty${i}`] || 0);
            }
            console.log("Redirecting to invoice.html with valid and user data");
            response.redirect(`./invoice.html?valid&name=${temp_user.name}&${params.toString()}`);

            return;
        } else {
            request.query.loginError = 'Incorrect password';
        }
    } else {
        request.query.loginError = 'Incorrect email';
    }

    request.query.email = entered_email;
    let params = new URLSearchParams(request.query);
    response.redirect(`./login.html?${params.toString()}`);
});


// Process continue shopping form
app.post("/continue_shopping", function (request, response) {
    let params = new URLSearchParams(temp_user);

    // Include product quantities in the URL
    for (let i in products) {
        params.set(`qty${i}`, temp_user[`qty${i}`]);
    }

    response.redirect(`/products_display.html?${params.toString()}`);
});

// Assuming you want to pass the order information to the invoice page

// Invoice route
app.get('/invoice', function (request, response) {
    // Log all cookies before setting new ones
    console.log('All Cookies before setting:', request.cookies);

    console.log('All Cookies after setting:', request.cookies);

    // Retrieve order information from cookies
    let order = [];
    for (let i in products) {
        let qty = request.cookies[`qty${i}`];
        if (qty > 0) {
            order.push({ product: products[i], quantity: qty });
            // checking if the cookies are working
            console.log(`Product ${i}, qty${i}:`, qty);
        }
    }

    console.log('Order:', order);
    // Read the invoice template file
    const fs = require('fs');
    const invoiceTemplate = fs.readFileSync('invoice.html', 'utf8');

    // Replace the placeholder with dynamically generated rows
    let invoiceContent = '';
    order.forEach(orderItem => {
        invoiceContent += `
            <tr>
                <td><img src="${orderItem.product.image}" class="img-small" name="img" data-tooltip="${orderItem.product.description}"></td>
                <td>${orderItem.product.name}</td>
                <td>${orderItem.quantity}</td>
                <td>$${orderItem.product.price.toFixed(2)}</td>
                <td>$${(orderItem.product.price * orderItem.quantity).toFixed(2)}</td>
            </tr>
        `;
    });

    // Replace the placeholder in the template with the dynamic content
    const finalInvoice = invoiceTemplate.replace('<!-- This is a placeholder for dynamic content -->', invoiceContent);

    // Send the modified HTML as the response
    response.send(finalInvoice);
});

// Process registration form
let registration_errors = {};

app.post("/process_register", function (request, response) {
    let reg_name = request.body.name;
    let reg_email = request.body.email.toLowerCase();
    let reg_password = request.body.password;
    let reg_confirm_password = request.body.confirm_password;

    validateConfirmPassword(reg_password, reg_confirm_password);
    validatePassword(reg_password);
    validateEmail(reg_email);
    validateName(reg_name);

    if (Object.keys(registration_errors).length == 0) {
        const encryptedPassword = encryptPassword(reg_password);
        user_data[reg_email] = {};
        user_data[reg_email].name = reg_name;
        user_data[reg_email].password = encryptedPassword;

        fs.writeFile(__dirname + '/user_data.json', JSON.stringify(user_data), 'utf-8', (error) => {
            if (error) {
                console.log('Error updating user_data', error);
            } else {
                console.log('File written successfully. User data is updated.');

                temp_user['name'] = reg_name;
                temp_user['email'] = reg_email;

                let params = new URLSearchParams(temp_user);
                response.redirect(`/invoice.html?regSuccess&valid&${params.toString()}`);
            }
        });
    } else {
        delete request.body.password;
        delete request.body.confirm_password;

        let params = new URLSearchParams(request.body);
        response.redirect(`/register.html?${params.toString()}&${qs.stringify(registration_errors)}`);
    }
});

function validateConfirmPassword(password, confirm_password) {
    delete registration_errors['confirm_password_type'];

    if (confirm_password !== password) {
        registration_errors['confirm_password_type'] = 'Passwords do not match';
    }
}

function encryptPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha256').toString('hex');
    return `${salt}:${hash}`;
}

function validatePassword(password) {
    if (password.length <= 5 || password.length > 16) {
        registration_errors.password_error = "Password must be between 10 and 16 characters.";
    } else if (/\s/.test(password)) {
        registration_errors.password_error = "Password cannot contain spaces.";
    }
}

function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        registration_errors.email_error = "Invalid email format.";
    }
}

function validateName(name) {
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(name)) {
        registration_errors.name_error = "Invalid name format.";
    }
}

// Logout route
app.get('/logout', function (request, response) {
    // Clear relevant cookies
    for (let i in products) {
        response.clearCookie(`qty${i}`);
    }
    response.clearCookie('selectedItems');

    // Redirect to the login page or any other destination
    response.redirect('/login.html'); // Change the destination as needed
});
