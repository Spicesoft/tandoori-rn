import React, { Component } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Camera from "react-native-camera";

import createNavigateToServiceAction from "../../utils/createNavigateToServiceAction";


const ROOT_URL = "https://qr.cowork.io";
const serviceRegExp = new RegExp(
    `${ROOT_URL}/([0-9]+)` // capture service ID
);

export default class QRScanner extends Component {
    static navigationOptions = {
        title: "QR Scanner"
    };

    render() {
        return (
            <View style={styles.container}>
                <Camera
                    style={styles.preview}
                    aspect={Camera.constants.Aspect.fill}
                    onBarCodeRead={this.onBarCodeRead}
                />
            </View>
        );
    }

    extractServiceIDFromURL(url) {
        const results = serviceRegExp.exec(url);
        return results && results[1]; // first capture group
    }

    showError() {
        if (this._alertOpen) {
            return;
        }
        this._alertOpen = true;
        Alert.alert(
            "Invalid QR code",
            "We could not find a service linked to this QR code.",
            [{ text: "OK", onPress: () => (this._alertOpen = false) }]
        );
    }

    navigateToService(id) {
        this.props.navigation.dispatch(createNavigateToServiceAction({ id }));
    }

    onBarCodeRead = ev => {
        const url = ev.data;
        const id = this.extractServiceIDFromURL(url);
        if (id) {
            return this.navigateToService(id);
        }
        this.showError();

    };
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: "row"
    },
    preview: {
        flex: 1,
        justifyContent: "flex-end",
        alignItems: "center"
    }
});
