import React, { PropsWithChildren } from 'react'
import { MapMarkerProps } from '@/src/components/map-marker/map-marker.props';
import BallIcon from './ball.svg'
import styles from './map-marker.module.scss'

export default function MapMarker({children, onSelected, id}: PropsWithChildren<MapMarkerProps>): JSX.Element {
    const onBaloonClick = () => {
        onSelected && onSelected(id)
    }
    return (
        <div key={id} onClick={onBaloonClick}>
            <BallIcon width={15} height={15} />
            <div className={styles.marker}>
                {children}
            </div>
        </div>
    )
}