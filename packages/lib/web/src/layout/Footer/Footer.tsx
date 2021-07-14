import { FooterProps } from '@/src/layout/Footer/Footer.props';
import cn from 'classnames'
import styles from './Footer.module.scss'

export const Footer = ({ className, ...props }: FooterProps): JSX.Element => {
    return (
        <footer className={cn(className, styles.footer)} {...props}>
            ООО Культхаб © 2020 &mdash; {new Date().getFullYear()} Все права защищены
        </footer>
    )
}