@wip
Feature: Resharing
    A user who receives a file with editor privileges may re-share a file with other DMs or rooms.

    A user may share a file with a room, and then revoke access to that room. However,
    they may still share a file with a user who happens to be a member of a room, and that share can be
    managed independently.

    Re-sharing, if the user has the privileges to do so, automatically accepts the file invitation
    and adds the file to the user's drive.

    Background:
        Given I am logged in

    @editor
    Scenario: Re-share a received file from DM to room
        When I receive a file in a DM
        Then I can re-share the file in a room
        And the invitation to the file will have been accepted

    @viewer
    Scenario: Cannot re-share a received file from DM to room
        When I receive a file in a DM
        Then I will see it in my file stream
        Then I cannot re-share the file in a room

    @editor
    Scenario: Re-share a received file from DM to DM
        When I receive a file in a DM
        Then I will see it in my file stream
        Then I can re-share the file in another DM
        And I will see it in my drive
        And the invitation will be accepted
        And my storage usage will increase
        And the recipient will see it in their file stream
        But their storage usage will not increase
        And the owner will see that I shared the file with someone

    @viewer
    Scenario: Re-share a received file from DM to DM
        When I receive a file in a DM
        Then I will see it in my file stream
        But I cannot re-share the file in a DM

    @editor
    Scenario: Re-share file from room to room with different participants
        When I receive a file in a room
        Then I will see it in my file stream
        Then I can re-share the file in another room
        Then I will see it in my drive
        And the invitation will be accepted
        And my storage usage will increase
        And the recipients will see it in their file streams
        But their storage usage will not increase
        And the owner will see that I shared the file in a room they can't access

    @viewer
    Scenario: Cannot re-share a received file from room to room
        When I receive a file in a room
        Then I will see it in my file stream
        But I cannot re-share the file in a room

    @editor
    Scenario: Re-share a file from room to DM
        When I receive a file in a room
        Then I will see it in my file stream
        Then I can re-share the file in a DM
        Then I will see it in my drive
        And the invitation will be accepted
        And my storage usage will increase
        And the recipient will see it in their file stream
        But their storage usage will not increase
        And the owner will see in the permissions audit that I shared the file with someone

    @viewer
    Scenario: Cannot re-share a file from room to DM
        When I receive a file in a room
        Then I will see it in my file stream
        But I cannot re-share the file in a DM

    @editor
    Scenario: Share with room and re-share with individual from room
        When I receive a file in a room
        And re-share it with a participant in that room individually
        Then both the room and the participant will appear in the permissions audit
