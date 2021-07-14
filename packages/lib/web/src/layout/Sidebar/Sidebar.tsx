import { LayoutProps } from '@/src/layout/Layout.props';
import { SidebarProps } from '@/src/layout/Sidebar/Sidebar.props';

export const Sidebar = ({ ...props }: SidebarProps): JSX.Element => {
    return (
        <div {...props}>
            Sidebar
        </div>
    )
}