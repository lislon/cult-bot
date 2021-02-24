export class TwoWayMap<T, K> {
    map: Map<T, K>;
    reverseMap: Map<K, T>;

    constructor(data: Iterable<readonly [T, K]>) {
        this.map = new Map(data);
        this.reverseMap = new Map<K, T>();
        this.map.forEach((value, key) => {
            this.reverseMap.set(value, key);
        });
    }

    get(key: T) {
        return this.map.get(key);
    }

    revGet(key: K) {
        return this.reverseMap.get(key);
    }
}