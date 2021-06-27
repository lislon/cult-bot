export function myMocked<T extends (...args: unknown[]) => unknown>(val: T): jest.MockInstance<ReturnType<T>, unknown[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return val as any
}