export function fieldIsQuestionMarkOrEmpty(str: string) {
    const trim = str.trim()
    return trim === '???' || trim === ''
}