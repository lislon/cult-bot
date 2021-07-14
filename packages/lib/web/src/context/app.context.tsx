import { createContext, PropsWithChildren, useState } from 'react';

export interface IAppContext {
    mapItemSelectedId?: number
    selectMapItem?: (newSelectedId: number) => void
}

export const AppContext = createContext<IAppContext>({

})

export const AppContextProvider = ({ children, mapItemSelectedId }: PropsWithChildren<IAppContext>) => {
    const [mapItemSelectedIdState, setSelectMapItemState] = useState<number>()
    const selectMapItem = (mapItemSelectedId: number) => {
        setSelectMapItemState(mapItemSelectedId)
    }

    return (
        <AppContext.Provider value={{ mapItemSelectedId: mapItemSelectedIdState, selectMapItem }}>
            {children}
        </AppContext.Provider>
    );
}