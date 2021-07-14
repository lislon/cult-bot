import { HeaderProps } from '@/src/layout/Header/Header.props';

export const Header = ({ ...props }: HeaderProps): JSX.Element => {
    return (
        <div {...props}>
            Header
        </div>
    )
}