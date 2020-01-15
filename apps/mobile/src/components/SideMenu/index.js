// @flow

import React from 'react';
import {
  PanResponder,
  View,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  Easing,
} from 'react-native';
import PropTypes from 'prop-types';
import styles from './styles';
import * as Animatable from 'react-native-animatable';
const deviceScreen = Dimensions.get('window');
const barrierForward = deviceScreen.width / 4;

function shouldOpenMenu(dx) {
  return dx > barrierForward;
}

export default class SideMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.prevLeft = 0;
    this.isOpen = !!props.isOpen;
    this.isGestureEnabled = true;
    this.overlay;
    this.opacity = new Animated.Value(0);

    const initialMenuPositionMultiplier =
      props.menuPosition === 'right' ? -1 : 1;
    const openOffsetMenuPercentage = props.openMenuOffset / deviceScreen.width;
    const hiddenMenuOffsetPercentage =
      props.hiddenMenuOffset / deviceScreen.width;
    const left = new Animated.Value(
      props.isOpen
        ? props.openMenuOffset * initialMenuPositionMultiplier
        : props.hiddenMenuOffset,
    );

    this.onLayoutChange = this.onLayoutChange.bind(this);
    this.onStartShouldSetResponderCapture = props.onStartShouldSetResponderCapture.bind(
      this,
    );
    this.onMoveShouldSetPanResponder = this.handleMoveShouldSetPanResponder.bind(
      this,
    );
    this.onPanResponderMove = this.handlePanResponderMove.bind(this);
    this.onPanResponderRelease = this.handlePanResponderEnd.bind(this);
    this.onPanResponderTerminate = this.handlePanResponderEnd.bind(this);

    this.state = {
      width: deviceScreen.width,
      height: deviceScreen.height,
      openOffsetMenuPercentage,
      openMenuOffset: deviceScreen.width * openOffsetMenuPercentage,
      hiddenMenuOffsetPercentage,
      hiddenMenuOffset: deviceScreen.width * hiddenMenuOffsetPercentage,
      left,
    };

    this.state.left.addListener(({value}) =>
      this.props.onSliding(
        Math.abs(
          (value - this.state.hiddenMenuOffset) /
            (this.state.openMenuOffset - this.state.hiddenMenuOffset),
        ),
      ),
    );
  }

  componentWillMount() {
    this.responder = PanResponder.create({
      onStartShouldSetResponderCapture: this.onStartShouldSetResponderCapture,
      onMoveShouldSetPanResponder: this.onMoveShouldSetPanResponder,
      onPanResponderMove: this.onPanResponderMove,
      onPanResponderRelease: this.onPanResponderRelease,
      onPanResponderTerminate: this.onPanResponderTerminate,
    });
  }

  /*  UNSAFE_componentWillReceiveProps(props) {
    if (
      typeof props.isOpen !== 'undefined' &&
      this.isOpen !== props.isOpen &&
      (props.autoClosing || this.isOpen === false)
    ) {
      this.openMenu(props.isOpen);
    }
  } */

  onLayoutChange(e) {
    const {width, height} = e.nativeEvent.layout;
    const openMenuOffset = width * this.state.openOffsetMenuPercentage;
    const hiddenMenuOffset = width * this.state.hiddenMenuOffsetPercentage;
    this.setState({width, height, openMenuOffset, hiddenMenuOffset});
  }

  /**
   * Get content view. This view will be rendered over menu
   * @return {React.Component}
   */
  getContentView() {
    //let overlay = null;

    const {width, height} = this.state;
    const ref = sideMenu => (this.sideMenu = sideMenu);
    const style = [
      styles.frontView,
      {width, height},
      this.props.animationStyle(this.state.left),
    ];

    return (
      <Animated.View style={style} ref={ref} {...this.responder.panHandlers}>
        {this.props.children}

        <TouchableWithoutFeedback onPress={() => this.openMenu(false)}>
          <Animated.View
            ref={ref => (this.overlay = ref)}
            style={{
              display: 'none',
              position: 'relative',
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              backgroundColor: 'black',
              opacity: this.opacity,
            }}
          />
        </TouchableWithoutFeedback>
      </Animated.View>
    );
  }

  changeOpacity(opacity) {
    if (opacity === 0.5) {
      this.overlay.setNativeProps({
        style: {
          display: 'flex',
          position: 'absolute',
        },
      });
    }
    Animated.timing(this.opacity, {
      toValue: opacity,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      if (opacity === 0) {
        this.overlay.setNativeProps({
          style: {
            display: 'none',
            position: 'relative',
          },
        });
      }
    });
  }

  moveLeft(offset) {
    const newOffset = this.menuPositionMultiplier() * offset;

    this.props.animationFunction(this.state.left, newOffset).start();

    this.prevLeft = newOffset;
  }

  menuPositionMultiplier() {
    return this.props.menuPosition === 'right' ? -1 : 1;
  }

  handlePanResponderMove(e, gestureState) {
    if (this.state.left.__getValue() * this.menuPositionMultiplier() >= 0) {
      let newLeft = this.prevLeft + gestureState.dx;

      if (
        !this.props.bounceBackOnOverdraw &&
        Math.abs(newLeft) > this.state.openMenuOffset
      ) {
        newLeft = this.menuPositionMultiplier() * this.state.openMenuOffset;
      }

      let o = newLeft / this.props.openMenuOffset;
      this.opacity.setValue(o * 0.5);

      this.props.onMove(newLeft);
      this.state.left.setValue(newLeft);
    }
  }

  handlePanResponderEnd(e, gestureState) {
    const offsetLeft =
      this.menuPositionMultiplier() *
      (this.state.left.__getValue() + gestureState.dx);

    this.openMenu(shouldOpenMenu(offsetLeft));
  }

  handleMoveShouldSetPanResponder(e, gestureState) {
    if (this.gesturesAreEnabled()) {
      const x = Math.round(Math.abs(gestureState.dx));
      const y = Math.round(Math.abs(gestureState.dy));

      const touchMoved = x > this.props.toleranceX && y < this.props.toleranceY;

      if (this.isOpen) {
        return touchMoved;
      }
      this.overlay.setNativeProps({
        style: {
          display: 'flex',
          position: 'absolute',
        },
      });
      const withinEdgeHitWidth =
        this.props.menuPosition === 'right'
          ? gestureState.moveX > deviceScreen.width - this.props.edgeHitWidth
          : gestureState.moveX < this.props.edgeHitWidth;

      const swipingToOpen = this.menuPositionMultiplier() * gestureState.dx > 0;
      return withinEdgeHitWidth && touchMoved && swipingToOpen;
    }

    return false;
  }

  openMenu(isOpen) {
    const {hiddenMenuOffset, openMenuOffset} = this.state;
    this.changeOpacity(isOpen ? 0.5 : 0);
    this.moveLeft(isOpen ? openMenuOffset : hiddenMenuOffset);

    this.isOpen = isOpen;

    this.forceUpdate();
    this.props.onChange(isOpen);
  }

  setGestureEnabled(enabled) {
    this.isGestureEnabled = enabled;
  }

  gesturesAreEnabled() {
    return this.isGestureEnabled;
  }

  render() {
    const boundryStyle =
      this.props.menuPosition === 'right'
        ? {left: this.state.width - this.state.openMenuOffset}
        : {right: this.state.width - this.state.openMenuOffset};

    const menu = (
      <View style={[styles.menu, boundryStyle]}>{this.props.menu}</View>
    );

    return (
      <View style={styles.container} onLayout={this.onLayoutChange}>
        {menu}

        {this.getContentView()}
      </View>
    );
  }
}

SideMenu.propTypes = {
  edgeHitWidth: PropTypes.number,
  toleranceX: PropTypes.number,
  toleranceY: PropTypes.number,
  menuPosition: PropTypes.oneOf(['left', 'right']),
  onChange: PropTypes.func,
  onMove: PropTypes.func,
  children: PropTypes.node,
  menu: PropTypes.node,
  openMenuOffset: PropTypes.number,
  hiddenMenuOffset: PropTypes.number,
  animationStyle: PropTypes.func,
  disableGestures: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
  animationFunction: PropTypes.func,
  onStartShouldSetResponderCapture: PropTypes.func,
  isOpen: PropTypes.bool,
  bounceBackOnOverdraw: PropTypes.bool,
  autoClosing: PropTypes.bool,
};

SideMenu.defaultProps = {
  toleranceY: 10,
  toleranceX: 10,
  edgeHitWidth: 60,
  children: null,
  menu: null,
  openMenuOffset: deviceScreen.width * (2 / 3),
  disableGestures: false,
  menuPosition: 'left',
  hiddenMenuOffset: 0,
  onMove: () => {},
  onStartShouldSetResponderCapture: () => true,
  onChange: () => {},
  onSliding: () => {},
  animationStyle: value => ({
    transform: [
      {
        translateX: value,
      },
    ],
  }),
  animationFunction: (prop, value) =>
    Animated.timing(prop, {
      toValue: value,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.elastic(0.5),
    }),
  isOpen: false,

  bounceBackOnOverdraw: true,
  autoClosing: true,
};
