//Server.js
// Import required modules
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const qs = require('querystring');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const nodemailer = require('nodemailer');

// Create an instance of the Express application
const app = express();

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware to log cookies
app.use((req, res, next) => {
    console.log('Cookies:', req.cookies);
    next();
});
// Add express-session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

// Serve static files from the 'public' directory
app.use(express.static(__dirname + '/public'));

// Load product data from 'products.json' file

let productsData = require(__dirname + '/products.json');
let products = [];

// Flatten the array of arrays to a single array of products
productsData.forEach(category => {
    category.forEach(product => {
        products.push(product);
    });
});

// Initialize 'qty_sold' property for each product
products.forEach(product => {
    if (!product.qty_sold) {
        product.qty_sold = 0;
    }
});

// Middleware to check user authentication
const authenticateUser = (req, res, next) => {
    // Check if the user is logged in
    if (!req.session || !req.session.user || !req.session.user.email) {
        // Exclude the /process_purchase route from redirection
        if (req.originalUrl !== '/process_purchase') {
            // Store intended destination in session
            req.session.intendedDestination = req.originalUrl;
            // Redirect to the login page if not logged in
            return res.redirect('/login.html');
        }
    }

    // Continue to the next middleware if authenticated
    next();
};
// Apply the middleware to relevant routes
app.get('/cart', authenticateUser, (req, res) => {
    // Your existing route logic here
});

app.post('/process_purchase', authenticateUser, (req, res) => {
    // Your existing route logic here
});
// Function to validate quantity input
function validateQuantity(quantity, availableQuantity) {
    let errors = [];
    quantity = Number(quantity);

    switch (true) {
        case isNaN(quantity) || quantity === '':
            errors.push("Not a number. Please enter a non-negative quantity");
            break;
        case quantity < 0 && !Number.isInteger(quantity):
            errors.push("Not an integer. Please enter a non-negative quantity");
            break;
        case quantity < 0:
            errors.push("Negative quantity. Please enter a non-negative quantity");
            break;
        case quantity > availableQuantity:
            errors.push("Not enough items in stock");
            break;
    }
    return errors;
}

// Route to serve the 'products.js' file
app.get("/products.js", (request, response, next) => {
    response.type('.js');
    let products_str = `var products = ${JSON.stringify(products)};`;
    response.send(products_str);
});

// Load user data from 'user_data.json' file
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

// Temporary user object to store user data during the session
let temp_user = {};

// Route to process purchase form submission
app.post("/process_purchase", (request, response) => {
    let POST = request.body;
    console.log("Received form data:", POST);
    let has_qty = false;
    let errorObject = {};

    // Clear quantity cookies for all products
    for (let i in products) {
        response.clearCookie(`qty${i}`);
    }

    // Process quantity input for each product
    for (let i in products) {
        let qty = POST[`qty${i}`];
        has_qty = has_qty || (qty > 0);

        let errorMessage = validateQuantity(qty, products[i].quantity_available);

        if (errorMessage.length > 0) {
            errorObject[`qty${i}_error`] = errorMessage.join(', ');
        } else {
            response.cookie(`qty${i}`, qty);
            console.log(`Cookie qty${i} set to`, qty);

            if (qty > 0) {
                response.cookie(`product_${i}`, qty);
                temp_user[`qty${[i]}`] = qty;
            }
        }
    }

    // Store selected items in a cookie
    response.cookie('selectedItems', JSON.stringify(POST));

    // Redirect based on form validation and input
    if (has_qty == false && Object.keys(errorObject).length == 0) {
        console.log("Redirecting to products_display.html with error");
        response.redirect("./products_display.html?error");
    } else if (has_qty == true && Object.keys(errorObject).length == 0) {
        response.redirect('/cart');
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

// Route to generate and serve the invoice page
app.get('/invoice', function (request, response) {
    let selectedItems = {};
    for (let i in products) {
        let qty = request.cookies[`product_${i}`];
        if (qty > 0) {
            selectedItems[i] = qty;
        }
    }

    let order = [];
    for (let i in products) {
        let qty = request.cookies[`product_${i}`];
        if (qty > 0) {
            order.push({ product: products[i], quantity: qty });
        }
    }

    // Read the invoice template file
    const invoiceTemplate = fs.readFileSync('invoice.html', 'utf8');

    let invoiceContent = '';
    order.forEach(orderItem => {
        // Generate HTML content for each order item
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

    // Replace the placeholder in the invoice template with the generated content
    const finalInvoice = invoiceTemplate.replace('<!-- This is a placeholder for dynamic content -->', invoiceContent);

    // Send the final invoice HTML to the client
    response.send(finalInvoice);
});

// Function to process and send the invoice via email
function processInvoiceAndSendEmail(finalInvoice, userEmail) {
    // Set up the email transporter (using a test email account here)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'your-email@gmail.com',
            pass: 'your-email-password'
        }
    });

    // Email options
    const mailOptions = {
        from: 'your-email@gmail.com',
        to: userEmail,
        subject: 'Your Invoice from Tassia\'s Familiar Emporium',
        html: finalInvoice,
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            // Handle email sending error
        } else {
            console.log('Email sent:', info.response);
            // Handle email sent successfully
        }
    });
}

// Function to process and send the invoice via email
function processInvoiceAndSendEmail(finalInvoice, userEmail) {
    // Set up the email transporter (using a test email account here)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'your-email@gmail.com',
            pass: 'your-email-password'
        }
    });

    // Email options
    const mailOptions = {
        from: 'your-email@gmail.com',
        to: userEmail,
        subject: 'Your Invoice from Tassia\'s Familiar Emporium',
        html: finalInvoice,
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            // Handle email sending error
        } else {
            console.log('Email sent:', info.response);
            // Handle email sent successfully
        }
    });
}
// Route to get the cart data as JSON
app.get('/get_cart', (req, res) => {
    const cart = [];
    for (let i in products) {
        let qty = req.cookies[`product_${i}`];
        if (qty > 0) {
            cart.push({ product: products[i], quantity: qty });
        }
    }

    res.json(cart);
});

// Route to render the cart page
app.get('/cart', (req, res) => {
    // Retrieve selected items and quantities from cookies
    const selectedItems = [];
    for (let i in products) {
        let qty = req.cookies[`product_${i}`];
        if (qty > 0) {
            selectedItems.push({ product: products[i], quantity: qty });
        }
    }

    // Check if the user is authenticated
    if (!req.session || !req.session.user || !req.session.user.email) {
        // If not authenticated, store the intended destination in the session
        req.session.intendedDestination = '/cart';
        return res.redirect('/login.html');
    }

    // If authenticated, render the 'cart' view with selected items
    res.render('cart', { selectedItems });
});
// Route to process login form submission
app.post("/process_login", (request, response) => {
    let POST = request.body;
    let entered_email = POST['email'].toLowerCase();
    let entered_password = POST['password'];

    // Check if email and password are entered
    if (entered_email.length == 0 && entered_password.length == 0) {
        request.query.loginError = 'Please enter email and password';
        response.redirect(`./login.html?${qs.stringify(request.query)}`);
        return;
    }

    // Check if email exists in user data
    if (user_data[entered_email]) {
        const [storedSalt, storedHash] = user_data[entered_email].password.split(':');
        const enteredHash = crypto.pbkdf2Sync(entered_password, storedSalt,
            10000, 512, 'sha256').toString('hex');
        // Check if entered password matches stored password
        if (enteredHash === storedHash) {
            temp_user['email'] = entered_email;
            temp_user['name'] = user_data[entered_email].name;

            for (let i in products) {
                temp_user[`qty${[i]}`] = POST[`qty${[i]}`] || 0;
            }

            response.cookie('temp_user', JSON.stringify(temp_user));

            // Update the user's cart information in the session
            if (temp_user.email) {
                request.session.user = {
                    email: temp_user.email,
                    name: temp_user.name,
                    cart: {
                        // Include cart information here
                    }
                };

                // Redirect to the welcome page after login
                response.redirect('/welcome.html');
                return;
            }
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

// Route to process continue shopping form submission
app.post("/continue_shopping", function (request, response) {
    for (let i in products) {
        temp_user[`qty${i}`] = parseInt(request.body[`qty${i}`]) || 0;
    }

    response.cookie('temp_user', temp_user);

    response.redirect(`/products_display.html`);
});

// Object to store registration errors
let registration_errors = {};

// Route to process registration form submission
app.post("/process_register", function (request, response) {
    let reg_name = request.body.name;
    let reg_email = request.body.email.toLowerCase();
    let reg_password = request.body.password;
    let reg_confirm_password = request.body.confirm_password;

    // Validate confirm password
    validateConfirmPassword(reg_password, reg_confirm_password);

    // Validate password
    validatePassword(reg_password);

    // Validate email
    validateEmail(reg_email);

    // Validate name
    validateName(reg_name);

    // If no registration errors, save user data to file
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

                response.cookie('temp_user', temp_user);

                response.redirect(`/invoice.html?regSuccess&valid`);
            }
        });
    } else {
        delete request.body.password;
        delete request.body.confirm_password;

        let params = new URLSearchParams(request.body);
        response.redirect(`/register.html?${params.toString()}&${qs.stringify(registration_errors)}`);
    }
});

// Function to validate confirm password
function validateConfirmPassword(password, confirm_password) {
    delete registration_errors['confirm_password_type'];

    if (confirm_password !== password) {
        registration_errors['confirm_password_type'] = 'Passwords do not match';
    }
}

// Function to encrypt password
function encryptPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha256').toString('hex');
    return `${salt}:${hash}`;
}

// Function to validate password
function validatePassword(password) {
    if (password.length <= 5 || password.length > 16) {
        registration_errors.password_error = "Password must be between 10 and 16 characters.";
    } else if (/\s/.test(password)) {
        registration_errors.password_error = "Password cannot contain spaces.";
    }
}

// Function to validate email
function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        registration_errors.email_error = "Invalid email format.";
    }
}

// Function to validate name
function validateName(name) {
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(name)) {
        registration_errors.name_error = "Invalid name format.";
    }
}

// Route to check user authentication status
app.get('/check_authentication', (req, res) => {
    if (req.session.user && req.session.user.email) {
        // User is authenticated
        res.json({ isAuthenticated: true });
    } else {
        // User is not authenticated
        res.json({ isAuthenticated: false });
    }
});

// Route to handle logout
app.get('/logout', (req, res) => {
    // Extract the email before destroying the session
    const userEmail = req.session.user ? req.session.user.email : 'User';
    
    // Clear session data
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        } else {
            // Add an alert message for user logout with email
            const alertMessage = `alert("${userEmail} logged out"); window.location.href = "/login.html";`;
            res.send(`<script>${alertMessage}</script>`);
        }
    });
});

// Start the server
const PORT = 8080;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
