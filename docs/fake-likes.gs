// Google docs for generating likes

function RAWLIKES(rating, popularity) {
    return popularity / 5 * 3 * rating
}

function RAWDISLIKES(rating, popularity) {
    const C5 = rating
    const D5 = popularity
    return 20 - C5
}

/**
 * Return fake likes
 *
 * @param {number|''} rating (0-20).
 * @param {number|''} popularity (0-5).
 * @param {number|''} random (0.0-1.0)
 * @return Fake likes
 * @customfunction
 */
function FAKELIKES(rating, popularity, random) {
    if (rating === '') {
        return ''
    } else if (random === '') {
        return '⚠️ random пуст'
    }

    const rawLikes = RAWLIKES(rating, popularity)
    const rawDislikes = RAWDISLIKES(rating, popularity)
    const J5 = (rawLikes / (rawLikes + rawDislikes)) * 20 * (popularity / 5)
    const R = (random - 0.5) * 2 * rawLikes * 0.1
    return `👍 ${Math.max(0, Math.round(J5 + R))}`
}

function FAKEDISLIKES(rating, popularity, random) {
    if (rating === '') {
        return ''
    } else if (random === '') {
        return '⚠️ random пуст'
    }

    const rawLikes = RAWLIKES(rating, popularity)
    const rawDislikes = RAWDISLIKES(rating, popularity)
    const J5 = rawDislikes / (rawLikes + rawDislikes) * 20 * (popularity / 5)
    const R = (random - 1) * 2
    return `👎 ${Math.max(0, Math.round(J5 + R))}`
}