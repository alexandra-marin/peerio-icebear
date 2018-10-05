import React from 'react';
import { observer } from 'mobx-react';
import css from 'classnames';
import { MaterialIcon } from 'peer-ui';

interface SideBarSectionProps {
    open: boolean;
    onToggle: () => void;
    title: string;
}

@observer
export default class SideBarSection extends React.Component<
    SideBarSectionProps
> {
    render() {
        return (
            <div
                className={css('sidebar-section', {
                    closed: !this.props.open,
                    open: this.props.open
                })}
            >
                <div
                    className={css('p-list-heading', {
                        clickable: this.props.onToggle
                    })}
                    onClick={this.props.onToggle}
                >
                    <div className="section-title">{this.props.title}</div>
                    {this.props.onToggle && (
                        <MaterialIcon
                            icon={
                                this.props.open
                                    ? 'arrow_drop_up'
                                    : 'arrow_drop_down'
                            }
                        />
                    )}
                </div>
                <div className="section-content">
                    {this.props.open ? this.props.children : null}
                </div>
            </div>
        );
    }
}
