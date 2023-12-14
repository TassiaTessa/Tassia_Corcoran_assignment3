const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const qs = require('querystring');
const cookieParser = require('cookie-parser');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
    console.log('Cookies:', req.cookies);
    next();
});

app.use(express.static(__dirname + '/public'));

let products = require(__dirname + '/products.json');

products.forEach(product => {
    if (!product.qty_sold) {
        product.qty_sold = 0;
    }
});

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

app.get("/products.js", (request, response, next) => {
    response.type('.js');
    let products_str = `var products = ${JSON.stringify(products)};`;
    response.send(products_str);
});

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

let temp_user = {};

app.post("/process_purchase", (request, response) => {
    let POST = request.body;
    console.log("Received form data:", POST);
    let has_qty = false;
    let errorObject = {};

    for (let i in products) {
        response.clearCookie(`qty${i}`);
    }

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

    response.cookie('selectedItems', JSON.stringify(POST));

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

    const invoiceTemplate = fs.readFileSync('invoice.html', 'utf8');

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

    const finalInvoice = invoiceTemplate.replace('<!-- This is a placeholder for dynamic content -->', invoiceContent);

    response.send(finalInvoice);
});

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

app.get('/cart', (req, res) => {
    // Retrieve selected items and quantities from cookies
    const selectedItems = [];
    for (let i in products) {
        let qty = req.cookies[`product_${i}`];
        if (qty > 0) {
            selectedItems.push({ product: products[i], quantity: qty });
        }
    }

    // Display the cart page with selected items
    res.render('cart', { selectedItems });
});app.post("/process_login", (request, response) => {
    let POST = request.body;
    let entered_email = POST['email'].toLowerCase();
    let entered_password = POST['password'];

    if (entered_email.length == 0 && entered_password.length == 0) {
        request.query.loginError = 'Please enter email and password';
        response.redirect(`./login.html?${qs.stringify(request.query)}`);
        return;
    }

    if (user_data[entered_email]) {
        const [storedSalt, storedHash] = user_data[entered_email].password.split(':');
        const enteredHash = crypto.pbkdf2Sync(entered_password, storedSalt,
            10000, 512, 'sha256').toString('hex');
        if (enteredHash === storedHash) {
            temp_user['email'] = entered_email;
            temp_user['name'] = user_data[entered_email].name;

            for (let i in products) {
                temp_user[`qty${[i]}`] = POST[`qty${[i]}`] || 0;
            }

            response.cookie('temp_user', temp_user);

            // Update the user's cart information in the session
            if (temp_user.email) {
                request.session.user = {
                    email: temp_user.email,
                    name: temp_user.name,
                    cart: {
                        // Include cart information here
                    }
                };
            }

            response.redirect(`./invoice.html?valid&name=${temp_user.name}`);

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


app.post("/continue_shopping", function (request, response) {
    for (let i in products) {
        temp_user[`qty${i}`] = parseInt(request.body[`qty${i}`]) || 0;
    }

    response.cookie('temp_user', temp_user);

    response.redirect(`/products_display.html`);
});

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

const PORT = 8080;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

