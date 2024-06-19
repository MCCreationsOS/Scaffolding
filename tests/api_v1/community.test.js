const { expect } = require("@jest/globals");
const { default: test } = require("node:test");

test('Get user by handle', async() => {
    const res = await fetch(`https://localhost:8080/creator/crazycowmm`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('username')
    expect(data.username).toBe("CrazyCowMM")
})

test('Get user by handle - not found', async() => {
    const res = await fetch(`https://localhost:8080/creator/doesnotexist`)
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data).toHaveProperty('error')
    expect(data.error).toBe("User not found")
})

test('Rate content', async() => {
    const res = await fetch(`https://localhost:8080/rate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            rating: 5,
            content: {
                slug: "test_content",
                ratings: []
            }
        })
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('rating')
    expect(data.rating).toBe(5)
})

test('Rate content with ratings', async() => {
    const res = await fetch(`https://localhost:8080/rate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            rating: 5,
            content: {
                slug: "test_content",
                ratings: [
                    4, 4
                ]
            }
        })
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('rating')
    expect(data.rating).toBe(4.25)
})