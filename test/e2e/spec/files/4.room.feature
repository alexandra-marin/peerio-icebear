@off
Feature: Files in rooms
    Files may be shared in rooms. When a file is shared in a room, the room as a whole is invited to it.

    The share can be thought of as a standing invitation for anyone in the room (past, present, future) to accept the files
    so long as the invitation is there. Accepted invitations can and must be managed separately from the invitation
    to the room.

    This means that:

    (1) When a user accepts an invitation to a file (by adding it to their drive), they will be listed in the permissions audit
    separately.

    (2) When a user revokes an invitation to a file from a room, they will additionally have to revoke the file from those
    users who have accepted the invitation -- though these actions may be combined (or prompted) in the UI.

    (3) If a user has accepted a file invitation via the room, those files will be retained after leaving the room.
    They will only be removed if the owner/sharer explicitly unshares with that user.

    However, an individual user within a room cannot be given LESS privileges on a file than a room they are in.

    Background:
        Given I am logged in

    Scenario: Join a room and see files in it
        When I join a room with files in it
        Then those files will be in my file stream
        And I am in the permissions audit for those files

    Scenario: Share with room as editor by default
        Given I join a room
        When I share a file in the room
        Then the room is invited to have editor privileges on the file

    Scenario: Share with room and see individual acceptances
        Given I join a room
        And that room has multiple participants
        When I share a file in the room
        And a participant accepts my invitation
        Then the permissions audit shows that the room is invited
        And the permissions audit shows that the participant accepted the file

    Scenario: Unshare from room
        Given I join a room
        When I share a file in the room
        Then I can unshare the file from the room
        And the room will not have editor privileges

    Scenario: Leave a room
        Given I join a room
        And I share a file
        When I leave the room
        Then the room will not have editor privileges

    Scenario: Leave a room and retain accepted files
        Given I join a room
        And I share a file
        And a member of the room accepts the invitation to the file
        When I leave the room
        Then the room will not have editor privileges to my file
        But the user who accepted the invitation will remain an editor
        And I can remove them
        And they will not have editor privileges

    Scenario: Cannot revoke permissions from room member
        Given I join a room which has a file shared in it with editing privileges
        When I accept the file invitation
        Then my acceptance is in the permissions audit
        But they cannot make me a viewer
