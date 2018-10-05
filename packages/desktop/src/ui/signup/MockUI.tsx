import React from 'react';
import { observer } from 'mobx-react';
import css from 'classnames';
import _ from 'lodash';
import { MaterialIcon } from 'peer-ui';

interface MockProps {
    className?: string;
}

interface CircleProps extends MockProps {
    color?: 'blue' | 'purple' | 'yellow' | 'greyblue';
}

@observer
export class Circle extends React.Component<CircleProps> {
    render() {
        return (
            <div
                className={css(
                    this.props.className,
                    this.props.color || 'blue',
                    'mock-circle'
                )}
            >
                {this.props.children}
            </div>
        );
    }
}

interface LineProps extends MockProps {
    shade?: 'light' | 'dark' | 'verydark';
    width?: number; // Number between 1-6. Corresponds to the width as fraction /6 of full-width.
}

@observer
export class Line extends React.Component<LineProps> {
    render() {
        return (
            <div
                className={css(
                    'mock-line',
                    `width-${this.props.width || 1}`,
                    this.props.shade || 'light',
                    this.props.className
                )}
            />
        );
    }
}

interface ChatEntryProps extends MockProps {
    color?: 'blue' | 'purple' | 'yellow' | 'greyblue'; // copied from CircleProps
    circleContent?: any;

    // number => <Line/> width. Otherwise, any HTML content works.
    heading?: number | any;

    // number[] => <Line/> widths. Otherwise, any HTML content works.
    lines?: number[] | any;
}

@observer
export class ChatEntry extends React.Component<ChatEntryProps> {
    get heading() {
        return typeof this.props.heading === 'number' ? (
            <Line shade="dark" width={this.props.heading} />
        ) : (
            <div className="chat-heading">{this.props.heading}</div>
        );
    }

    get lines() {
        return _.isArray(this.props.lines)
            ? this.props.lines.map((line, i) => {
                  return <Line key={`line-${i}`} shade="light" width={line} />; // eslint-disable-line
              })
            : this.props.lines;
    }

    render() {
        return (
            <div className={css('mock-chat-entry', this.props.className)}>
                <Circle color={this.props.color}>
                    {this.props.circleContent}
                </Circle>
                <div className="text">
                    {this.heading}
                    <div className="body">{this.lines}</div>
                </div>
            </div>
        );
    }
}

export class ChatInput extends React.PureComponent<MockProps> {
    render() {
        return (
            <div className="mock-message-input">
                <MaterialIcon icon="add_circle_outline" />
            </div>
        );
    }
}

@observer
export class SearchBar extends React.Component<MockProps> {
    render() {
        return (
            <div className="mock-search-bar">
                <MaterialIcon icon="search" />
                <span>{this.props.children}</span>
            </div>
        );
    }
}

interface TextInputProps extends MockProps {
    active?: boolean;
    placeholder?: any;
}

@observer
export class TextInput extends React.Component<TextInputProps> {
    render() {
        return (
            <div
                className={css('mock-text-input', {
                    active: this.props.active
                })}
            >
                <div className="label" />
                <div
                    className={css('text', {
                        placeholder:
                            !!this.props.placeholder && !this.props.children
                    })}
                >
                    {this.props.children || this.props.placeholder}
                </div>
            </div>
        );
    }
}
