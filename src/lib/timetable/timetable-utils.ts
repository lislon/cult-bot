export function cleanText(text: string) {
    const englishC = 'c'
    const russianC = 'с'
    return text.toLowerCase()
        .replace(englishC, russianC)
        .replace('[—‑]', '-')
        .replace(/\s+/, ' ')
        .trim()
        ;
}