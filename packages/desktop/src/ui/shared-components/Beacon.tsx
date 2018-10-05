import React from 'react';
import ReactDOM from 'react-dom';
import {
    action,
    computed,
    observable,
    reaction,
    IReactionDisposer
} from 'mobx';
import { observer } from 'mobx-react';
import css from 'classnames';
import { t } from 'peerio-translator';
import beaconStore from '~/stores/beacon-store';

const appRoot = document.getElementById('root');

interface BeaconBaseProps {
    name: string;
    title?: string; // if no title, will check t('title_${name}_beacon')
    description?: string; // if no description, will use t('description_${name}_beacon')
    className?: string; // applied to the beacon itself. needed for styling, since beacon is portaled to appRoot.
    offsetX?: number;
    offsetY?: number;
    onBeaconClick?: () => void;
}

export interface SpotBeaconProps extends BeaconBaseProps {
    type: 'spot';
    circleContent?: any; // duplicates child content if this prop is not provided
    position?: 'right' | 'left'; // position of the bubble
    size?: number; // force a certain bubble size
    onContentClick?: () => void;
}

export interface AreaBeaconProps extends BeaconBaseProps {
    type: 'area';
    arrowPosition?: 'top' | 'right' | 'bottom' | 'left'; // position of the arrow on the rectangle
    arrowDistance?: number; // how far along the side of the rectangle to place the arrow, as a percentage
}

interface RectanglePosition {
    top?: string | number;
    right?: string | number;
    bottom?: string | number;
    left?: string | number;
    marginTop?: string | number;
    marginRight?: string | number;
    marginBottom?: string | number;
    marginLeft?: string | number;
    paddingRight?: string | number;
    paddingLeft?: string | number;
}

@observer
export default class Beacon extends React.Component<
    SpotBeaconProps | AreaBeaconProps
> {
    @computed
    get active() {
        return beaconStore.activeBeacon === this.props.name;
    }

    // We make a lot of calculations based on child content size and position
    // `contentRef` stores the ref for the .beacon-container component which contains the child content
    @observable contentRef;
    @observable rendered = false;
    setContentRef = ref => {
        if (ref) {
            this.contentRef = ref;
            this.setContentRect();
        }
    };

    // `contentRect` stores the bounding rect for the child content.
    // We give it default values to start, to prevent null references
    @observable
    contentRect = {
        top: 0,
        left: 0,
        height: 0,
        width: 0
    };

    @action.bound
    setContentRect() {
        if (this.contentRef) {
            this.contentRect = this.contentRef.getBoundingClientRect();
        }
    }

    @observable dispose: IReactionDisposer;
    @observable renderTimeout: NodeJS.Timer;
    componentWillMount() {
        // Update `contentRect` on window resize
        window.addEventListener('resize', this.setContentRect);

        this.dispose = reaction(
            () => this.active && !!this.contentRef,
            active => {
                if (active) {
                    this.renderTimeout = setTimeout(() => {
                        this.rendered = true;
                    }, 1);
                } else {
                    this.rendered = false;
                }
            }
        );
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.setContentRect);
        this.dispose();
        clearTimeout(this.renderTimeout);
        this.renderTimeout = null;
    }

    // The size of the SpotBeacon bubble can be defined in prop `size`.
    // If not defined, it is the greater of the child content's width and height.
    @computed
    get circleSize() {
        if (this.props.type === 'spot' && !!this.props.size)
            return this.props.size;
        const { height, width } = this.contentRect;
        return height > width ? height + 8 : width + 8;
    }

    // Beacon's overall positioning
    @computed
    get beaconStyle() {
        const contentTop = this.contentRect.top;
        const contentLeft = this.contentRect.left;
        const contentHeight = this.contentRect.height;
        const contentWidth = this.contentRect.width;

        let height: number = 0;
        let width: number = 0;
        let top: number = 0;
        let left: number = 0;
        let marginSize: number = 0;

        if (this.props.type === 'spot') {
            height = this.circleSize;
            width = this.circleSize;

            /*
                To center the SpotBeacon over the child content,
                first the entire beacon is oriented to the center of the child content,
                then it is negatively offset by 50% of the bubble's diameter.
            */
            top = contentTop + contentHeight / 2;
            left = contentLeft + contentWidth / 2;
            marginSize = -this.circleSize / 2;
        } else {
            height = contentHeight;
            width = contentWidth;
            top = contentTop;
            left = contentLeft;
        }

        // `offestX` and `offsetY` props can shift beacon position by arbitrary pixel value
        /* eslint-disable operator-assignment */
        if (this.props.offsetX) left = left + this.props.offsetX;
        if (this.props.offsetY) top = top + this.props.offsetY;
        /* eslint-enable operator-assignment */
        // In this instance operator-assignment looks more clunky and unintuitive

        return {
            height,
            width,
            top,
            left,
            marginTop: marginSize,
            marginLeft: marginSize
        };
    }

    // The bubble's vertical position is determined by the beacon's position in the window.
    // The window is divided into 5 horizontal "slices", each corresponding to a bubble position.
    @computed
    get slicePosition() {
        const sliceHeight = window.innerHeight / 5;
        return Math.floor(this.contentRect.top / sliceHeight) + 1;
    }

    // Position and 'slice' classes get repeated for the beacon itself, and the .rectangle and .circle divs
    // This is redundant, but helps keep the styles more organized
    @computed
    get positionClasses(): string {
        return this.props.type === 'spot'
            ? `${this.props.position || 'left'} slice-${this.slicePosition}`
            : this.props.arrowPosition || 'bottom';
    }

    /*
        Rectangle's positioning
        This is one of the trickier calculations, in part because it's completely different for Area and Spot Beacons
    */
    @observable
    rectangleRef: React.RefObject<HTMLDivElement> = React.createRef();

    @computed
    get rectanglePosition(): RectanglePosition | null {
        const ret = {} as RectanglePosition;

        let rectHeight: number = 0;
        let rectWidth: number = 0;
        if (this.rectangleRef && this.rectangleRef.current) {
            const rectangle = this.rectangleRef.current.getBoundingClientRect();
            rectHeight = rectangle.height;
            rectWidth = rectangle.width;
        }

        /*
            For SpotBeacon, rectangle needs to be positioned very precisely based on own size and circle size.
            There's a lot of offsets based on half of the rectangle height, or half the circle diameter.
        */
        if (this.props.type === 'spot') {
            const rectangleOffset = rectHeight / 2;
            const circleOffset = this.circleSize / 2;

            switch (this.slicePosition) {
                case 1:
                    ret.top = '0';
                    ret.marginTop = circleOffset;
                    break;
                case 2:
                    ret.top = '0';
                    break;
                case 3:
                default:
                    ret.top = '50%';
                    ret.marginTop = -rectangleOffset;
                    break;
                case 4:
                    ret.bottom = '0';
                    break;
                case 5:
                    ret.bottom = '0';
                    ret.marginBottom = circleOffset;
                    break;
            }

            if (this.props.position === 'right') {
                ret.paddingRight = circleOffset;
                ret.marginRight = -circleOffset;
            } else {
                ret.paddingLeft = circleOffset;
                ret.marginLeft = -circleOffset;
            }
        } else {
            const arrowPos = this.props.arrowPosition || 'bottom';
            const arrowDistance = this.props.arrowDistance || 0;

            /*
                arrowDistance is an integer representing far along the edge the arrow is placed, as a percent of the edge's length.
                However, remember that the beacon's arrow is in fact the anchor, and the rectangle is oriented according to the arrow.
                This means that the rectangle's position is offset in the *negative* direction.
                (The `24` is a hardcoded pixel value for the arrow's width, so that the rectangle offset can't under/overshoot the arrow.)
            */
            const xOffset =
                arrowPos === 'top' || arrowPos === 'bottom'
                    ? `-${(arrowDistance * (rectWidth - 48)) / 100 + 24}px`
                    : 0;
            const yOffset =
                arrowPos === 'left' || arrowPos === 'right'
                    ? `-${(arrowDistance * (rectHeight - 48)) / 100 + 24}px`
                    : 0;

            switch (arrowPos) {
                case 'top':
                    ret.top = '100%';
                    ret.left = this.contentRect.width / 2;
                    ret.marginLeft = xOffset;
                    break;
                case 'right':
                    ret.top = this.contentRect.height / 2;
                    ret.right = '100%';
                    ret.marginTop = yOffset;
                    break;
                case 'bottom':
                default:
                    ret.bottom = '100%';
                    ret.left = this.contentRect.width / 2;
                    ret.marginLeft = xOffset;
                    break;
                case 'left':
                    ret.top = this.contentRect.height / 2;
                    ret.left = '100%';
                    ret.marginTop = yOffset;
                    break;
            }
        }

        return ret;
    }

    // `narrow` class added when rectangle height is less than two lines of text
    // (currently a hardcoded pixel value of 72)
    @computed
    get isNarrow() {
        if (!this.rectangleRef || !this.rectangleRef.current) return null;
        return this.rectangleRef.current.getBoundingClientRect().height < 72;
    }

    // Clicking the rectangle
    beaconClick = () => {
        this.beaconFadeout();
        if (this.props.onBeaconClick) this.props.onBeaconClick();
    };

    // Clicking the content of the bubble in a SpotBeacon
    contentClick = () => {
        this.beaconFadeout();
        if (this.props.type === 'spot' && !!this.props.onContentClick)
            this.props.onContentClick();
    };

    // Fading out current beacon is called on both beaconClick and contentClick
    @action.bound
    beaconFadeout() {
        this.rendered = false;
        beaconStore.increment();
    }

    // Render the child content, wrapped in .beacon-container div so we can make the above positioning calculations
    get childContent() {
        return (
            <div
                key="beacon-container"
                className="beacon-container"
                ref={this.setContentRef}
            >
                {this.props.children}
            </div>
        );
    }

    beaconContent() {
        const title = this.props.title || t(`title_${this.props.name}_beacon`);
        const description =
            this.props.description ||
            t(`description_${this.props.name}_beacon`);

        return (
            <div
                key="beacon-content"
                className={css(
                    'beacon',
                    this.props.className,
                    `${this.props.type}-beacon`,
                    this.positionClasses,
                    {
                        show: this.rendered
                    }
                )}
                style={this.beaconStyle}
            >
                <div
                    ref={this.rectangleRef}
                    className={css('rectangle', this.positionClasses, {
                        narrow: this.isNarrow
                    })}
                    style={this.rectanglePosition}
                    onClick={this.beaconClick}
                >
                    <div className="rectangle-content">
                        {title ? <div className="header">{title}</div> : null}
                        {description}
                    </div>
                </div>

                {this.props.type === 'spot' ? (
                    <Bubble
                        position={this.positionClasses}
                        size={this.circleSize}
                        content={
                            this.props.circleContent || this.props.children
                        }
                        onClick={this.contentClick}
                    />
                ) : (
                    <Arrow position={this.positionClasses} />
                )}
            </div>
        );
    }

    render() {
        if (!this.active && !this.rendered) return this.childContent;

        const beaconContent = this.beaconContent();

        return [
            this.childContent,
            ReactDOM.createPortal(beaconContent, appRoot)
        ];
    }
}

interface ArrowProps {
    classNames?: string;
    position: string;
}

@observer
class Arrow extends React.Component<ArrowProps> {
    render() {
        return (
            <div
                className={css(
                    'arrow',
                    this.props.classNames,
                    this.props.position
                )}
            />
        );
    }
}

interface BubbleProps {
    classNames?: string;
    position: string;
    size: number;
    content: any;
    onClick?: () => void;
}

@observer
class Bubble extends React.Component<BubbleProps> {
    render() {
        return (
            <div
                className={css(
                    'circle',
                    this.props.classNames,
                    this.props.position
                )}
                style={{
                    height: this.props.size,
                    width: this.props.size
                }}
                onClick={this.props.onClick}
            >
                <div className="circle-content">{this.props.content}</div>
            </div>
        );
    }
}
