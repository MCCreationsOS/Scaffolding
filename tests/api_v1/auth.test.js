// import { UserTypes } from '../../api_v1/auth/types.js';

const { expect } = require("@jest/globals");

let TEST_USER_USERNAME = 'test_user';
let TEST_USER_EMAIL = 'test@gmail.com';
let TEST_USER_PASSWORD = 'password';
let token = '';

// Test register a new user
test('register a new user', async() => {
    const res = await fetch('http://localhost:8080/auth/signUpWithEmail', {
        method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: "test_user",
                email: "test@gmail.com",
                password: "password",
                type: 0
            })
    });
    expect(res.status).toBe(200)
})

// Test logging in
test('login with the new user', async() => {
    let token = await signUserIn(TEST_USER_EMAIL, TEST_USER_PASSWORD)
    expect(token).not.toBeUndefined()

    const check = await fetch(`http://localhost:8080/auth/user`, {
        headers: {
            'Authorization': `${token}`
        }
    })
    let checkData = await check.json()
    expect(checkData).toHaveProperty('user')
    expect(checkData.user.username).toBe(TEST_USER_USERNAME)
})

// Test login fail with bad password
test('Login with incorrect password', async() => {
    let token = await signUserIn(TEST_USER_EMAIL, "wrong_password")
    expect(token).toBeUndefined()
})

// Test updating user username
test('Update user profile', async() => {
    const res = await fetch(`http://localhost:8080/auth/user/updateProfile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({
            username: "better_test_user"
        })
    })
    expect(res.status).toBe(200)

    const check = await fetch(`http://localhost:8080/auth/user`, {
        headers: {
            'Authorization': `${token}`
        }
    })
    let checkData = await check.json()
    expect(checkData).toHaveProperty('user')
    expect(checkData.user.username).toBe("better_test_user")
    TEST_USER_USERNAME = "better_test_user"
})

// Test updating user handle
test('Update user handle', async() => {
    const res = await fetch(`http://localhost:8080/auth/user/updateHandle`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({
            handle: "better_test_handle"
        })
    })
    expect(res.status).toBe(200)

    await new Promise(resolve => setTimeout(resolve, 200))

    const check = await fetch(`http://localhost:8080/auth/user`, {
        headers: {
            'Authorization': token
        }
    })
    let checkData = await check.json()
    expect(checkData).toHaveProperty('user')
    expect(checkData.user.handle).toBe("better_test_handle")
})

// Test failing to update user handle
test('Fail to update user handle - already in use', async() => {
    const res = await fetch(`http://localhost:8080/auth/user/updateHandle`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({
            handle: "better_test_handle"
        })
    })
    let data = await res.json()
    expect(data).toHaveProperty('error')
})

// Test updating user email
test('Update user email', async() => {
    await signUserIn(TEST_USER_EMAIL, TEST_USER_PASSWORD)

    res = await fetch(`http://localhost:8080/auth/user/updateEmail`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({
            email: "better_email@gmail.com"
        })
    })
    expect(res.status).toBe(200)
    await new Promise(resolve => setTimeout(resolve, 200))

    await signUserIn("better_email@gmail.com", TEST_USER_PASSWORD)


    const check = await fetch(`http://localhost:8080/auth/user`, {
        headers: {
            'Authorization': `${token}`
        }
    })
    let checkData = await check.json()
    expect(checkData).toHaveProperty('user')
    expect(checkData.user.email).toBe("better_email@gmail.com")
    TEST_USER_EMAIL = "better_email@gmail.com"
})

// Test failing to update user email
test('Fail to update user email - already in use', async() => {
    const res = await fetch(`http://localhost:8080/auth/user/updateEmail`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({
            email: "better_email@gmail.com"
        })
    })
    let data = await res.json()
    expect(data).toHaveProperty('error')
})

// Test updating user password
test('Update user password', async() => {
    await signUserIn(TEST_USER_EMAIL, TEST_USER_PASSWORD)

    res = await fetch(`http://localhost:8080/auth/resetPassword`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({
            password: "better_password"
        })
    })
    expect(res.status).toBe(200)
    let oldToken = token

    await signUserIn(TEST_USER_EMAIL, "better_password")

    expect(token).not.toBe(oldToken)
    TEST_USER_PASSWORD = "better_password"
})

afterAll(async () => {
    // Cleanup if all tests pass
    await signUserIn(TEST_USER_EMAIL, TEST_USER_PASSWORD)

    await fetch(`http://localhost:8080/auth/user`, {
        method: 'DELETE',
        headers: {
            'Authorization': token,
        }
    })
})

async function signUserIn(email, password) {
    const res = await fetch(`http://localhost:8080/auth/signInWithEmail`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email,
            password: password,
            type: 0
        })
    })
    let data = await res.json()
    if(data.token) {
        token = data.token
    }
    return data.token
}