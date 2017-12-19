@wip
Feature: Unsharing

    Scenario: Cannot unshare from individual in room
        When I share a file in a room
        And a room member accepts the file invitation
        Then their acceptance is in the permissions audit
        But I cannot unshare from them unless I unshare from the room

    Scenario: Share in room, reshare in DM, and retain share after unsharing from room
        When I share a file with a room
        And then I share the same file with a member of the room in the DM
        And the member does not accept either invitation
        And I unshare the file with the room
        Then the individual member

    Scenario: Unshare file that hasn't been accepted
        When I upload a file
        And I share it in a DM
        Then I can unshare it
        And the recipient will not have it in their file stream
        And will not be able to accept the invitation

    Scenario: Unshare file that has been accepted
        When I upload a file
        And I share it in a DM
        And the recipient accepts the invitation
        Then the recipient will see it in their file stream
        Then I can unshare it
        And the recipient will not have it in their file stream

    Scenario: Delete a file
        When I upload a file
        And I share it in a DM
        And I share it in a room
        Then I can delete the file
        And the DM recipient will not have it in their file stream
        And the room members will not have it in their file streams
