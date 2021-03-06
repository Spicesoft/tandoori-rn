import React, { Component } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import PushNotification from "react-native-push-notification";
import {
    Alert,
    View
} from "react-native";
import {
    Button,
    Content,
    Card,
    CardItem,
    Text,
    Toast,
    Spinner,
    H1,
    H3
} from "native-base";

import Image from "../Image";
import API from "../../API";
import withRequest from "../../hoc/withRequest";


class ServiceWithoutRequest extends Component {
    static navigationOptions = {
        title: "Service"
    };
    static propTypes = {
        loading: PropTypes.bool,
        service: PropTypes.object,
        ranges: PropTypes.array
    };

    state = {
        refreshing: false
    };

    confirmReservation(range) {
        Alert.alert(
            "Confirm Reservation",
            `Confirm reservation for service ${this.props.service.name}`,
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "OK",
                    onPress: () => {
                        this.makeReservation(range);
                    }
                }
            ],
            { cancelable: true }
        );
    }

    async makeReservation(range) {
        try {
            await API.createReservation(this.props.service.pk, range);
        }
        catch (response) {
            Alert.alert("error creating a reservation", JSON.stringify(response));

            Toast.show({
                text: "Reservation failure",
                position: "bottom",
                buttonText: "Okay",
                duration: 2000
            });
            return;
        }

        PushNotification.localNotificationSchedule({
            /* Android Only Properties */
            largeIcon: "ic_cowork",
            smallIcon: "ic_cowork",
            bigText: "Your reservation is about to expire. Do you want to extend it?",
            subText: this.props.service.name,
            color: "#0074A6",
            vibration: 300,

            /* iOS and Android properties */
            title: "Reservation is expiring",
            message: "Your reservation is about to expire...",
            date: moment(range.to_datetime).subtract(5, "minutes").toDate(),
            // use this line to debug notifications (notif = now + 20 seconds)
            // date: moment().add(20, "s").toDate(),
            serviceId: this.props.service.pk,
            reservationEnd: range.to_datetime.format(),

            // iOS fix: https://github.com/zo0r/react-native-push-notification/issues/426
            number: 0
        });

        Toast.show({
            text: "Reservation success",
            position: "bottom",
            buttonText: "Okay",
            duration: 2000
        });

        this.props.navigation.goBack();
    }

    _onRefresh() {
        this.setState({ refreshing: true });
    }

    render() {
        if (this.props.loading) {
            return this.renderLoader();
        }

        const { service } = this.props;
        const image = service.images[0]; // TODO default image
        const imageSource = image
            ? { uri: image.medium_image_url }
            : require("../../img/test.jpg");

        return (
            <Content>
                <View style={styles.imageContainer}>
                    <Image
                        source={imageSource}
                        resizeMode="cover"
                        style={styles.image}
                    />
                </View>
                <View style={styles.titleContainer}>
                    <H1 style={styles.title}>{service.name}</H1>
                </View>

                <View style={styles.cont}>
                    {this.renderServiceStatus()}
                </View>
            </Content>
        );
    }

    renderServiceStatus() {
        const dispo = "ranges" in this.props && this.props.ranges.length != 0;

        if (!dispo) {
            return (
                <Card>
                    <CardItem>
                        <Text>
                            This service is unavailable for the moment.{"\n"}
                            {/* Next availability at : {"\n"} */}
                            {/* XXX:XXX */}
                        </Text>
                    </CardItem>
                </Card>
            );
        }
        return (
            <Card>
                <CardItem>
                    <H3>Book the service</H3>
                </CardItem>
                <CardItem>
                    <View style={{ flex: 1 }}>
                        {this.props.ranges.map(range =>
                            (<Button
                                block
                                style={{ margin: 5 }}
                                key={range.to_datetime.format()}
                                onPress={() =>
                                    this.confirmReservation(range)}
                            >
                                <Text>{`Until ${range.to_datetime.format(
                                    "LT"
                                )}`}</Text>
                            </Button>)
                        )}
                    </View>
                </CardItem>
            </Card>
        );

    }

    renderLoader() {
        return (
            <View style={styles.loadingRoot}>
                <Spinner color="rgb(70, 130, 180)" />
            </View>
        );
    }
}

const styles = {
    cont: {
        padding: 15
    },

    root: {
        flexDirection: "column",
        backgroundColor: "#FFFFFF"
    },

    imageContainer: {
        flexDirection: "row"
    },

    image: {
        height: 150,
        flex: 1
    },

    titleContainer: {
        alignItems: "center",
        padding: 5,
        backgroundColor: "rgb(70, 130, 180)"
    },

    title: {
        fontWeight: "bold",
        color: "white"
    },

    loadingRoot: {
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        flex: 1
    },

    card: {
        backgroundColor: "white",
        margin: 10,
        padding: 10,
        borderWidth: 1
    }
};

function isAvailable(availabilityRanges, start, end) {
    for (let i = 0; i < availabilityRanges.length; i++) {
        const { lower, upper } = availabilityRanges[i];
        const safeLower = lower || start; // null means -infinity so start as a lower bound is fine
        const safeUpper = upper || end; // same thing
        return safeLower <= start && end <= safeUpper;
    }
    return false;
}

function insideOpeningHours(start, end, centerOpeningHours) {
    let dayOfWeek = start.day() - 1;

    if (dayOfWeek == -1) {
        dayOfWeek = 6;
    }

    let openingHours;
    for (let i = 0; i < centerOpeningHours.length; i++) {
        if (centerOpeningHours[i].day == dayOfWeek) {
            openingHours = centerOpeningHours[i];
            break;
        }
    }

    if (openingHours === undefined) {
        return false;
    }

    // TODO take care of center timezone
    opening = moment(openingHours.opening_time, "HH:mm:ss");
    closing = moment(openingHours.closing_time, "HH:mm:ss");
    return opening <= start && end <= closing;
}

function extractRanges(availabilityRanges, openingHours, start = null) {
    // used provided start time or nowFloored
    if (!start) {
        const nowFloored = moment();
        if (nowFloored.minutes() < 30) {
            nowFloored.startOf("hour");
        }
        else {
            nowFloored.startOf("hour").add(30, "minutes");
        }
        start = nowFloored;
    }
    const nextHalfHour = moment(start).add(30, "minutes");
    const nextHour = moment(start).add(60, "minutes");
    const nextTwoHours = moment(start).add(120, "minutes");
    const ranges = [];

    [nextHalfHour, nextHour, nextTwoHours].forEach(end => {
        if (
            isAvailable(availabilityRanges, start, end) &&
            insideOpeningHours(start, end, openingHours)
        ) {
            ranges.push({
                from_datetime: start,
                to_datetime: end
            });
        }
    });
    return ranges;
}

const Service = withRequest(ServiceWithoutRequest, {
    requestProps: function request(props) {
        const { id, endOfReservationToExtend } = props.navigation.state.params;
        return Promise.all([
            API.getServiceDetails(id),
            API.getAvailabilityRangesForService(id)
        ]).then(([service, availabilityRanges]) => {
            return API.getCenterDetails(service.center_pk).then(center => {
                const centerOpeningHours = center.opening_hours;
                return {
                    service: service,
                    ranges: extractRanges(
                        availabilityRanges,
                        centerOpeningHours,
                        endOfReservationToExtend
                    )
                };
            });
        });
    }
});

export default Service;
