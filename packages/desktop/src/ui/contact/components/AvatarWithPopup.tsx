import React from 'react';
import { observer } from 'mobx-react';

import { Avatar } from 'peer-ui';
import ContactProfile from './ContactProfile';

interface AvatarWithPopupProps {
    contact: any;
    size?: 'tiny' | 'small' | 'medium' | 'large' | 'full';
    tooltip?: boolean;
}

@observer
export default class AvatarWithPopup extends React.Component<
    AvatarWithPopupProps
> {
    dialogRef!: ContactProfile;

    setDialogRef = (ref: ContactProfile | null) => {
        if (ref) this.dialogRef = ref;
    };

    openDialog = (ev: React.MouseEvent) => {
        ev.stopPropagation();
        this.dialogRef.openDialog();
    };

    render() {
        const popup = (
            <ContactProfile
                key={`avatarwithpopup-dialog-${this.props.contact.username}`}
                ref={this.setDialogRef}
                contact={this.props.contact}
            />
        );

        const avatar = (
            <Avatar
                key={`avatarwithpopup-avatar-${this.props.contact.username}`}
                contact={this.props.contact}
                size={this.props.size}
                tooltip={this.props.tooltip}
                onClick={this.openDialog}
            />
        );

        return [avatar, popup];
    }
}
