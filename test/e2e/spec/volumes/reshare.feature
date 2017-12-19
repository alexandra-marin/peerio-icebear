@wip
Feature: Sharing volumes
    Invitations to volumes must be accepted wholesale, although it is possible for users to mention
    files within volumes individually. These, however, will not end up in the file stream independently
    of the volume.

    Users may re-share individual files from a volume with users who they do not wish to invite to the volume -- or
    redundantly with users already sharing the volume.

    Individual shares, even when temporarily redundant (due to membership in a volume or room), will be added to
    the permissions matrix of a file. Thus, a file shared with a volume and then shared with a user who at the time
    has access to the volume, would receive an additional entry in the permissions matrix for the individual user.

    Since during the MVP we will not have reworked ndividual sharing of files, it is acceptable to have duplication in
    the user's drive when re-sharing a file that is also in a volume.

    Background:
        Given I am logged in
        And I am an editor of a volume
        And I have some contacts

    Scenario: Re-sharing a volume with a user who has accepted it
        When I share a volume with a contact
        And the contact accepts the invitation
        And I re-share the volume with the contact
        Then I will fail to reshare the volume
        And the contact will not receive another invitation

    Scenario: Re-sharing a volume with a user who has been invited
        When I share a volume with a contact
        And I re-share the volume with the contact
        Then the the contact will not be invited again
        But the contact will receive a DM referencing the volume
        And the contact can accept the invitation

    Scenario: Sharing a file from a volume with a user who shares the volume
        When I share a volume with a contact
        And I upload a file into the volume
        And the contact accepts the invitation
        And I re-share the file from the volume with that contact
        Then the user will receive a DM referencing the file
        And the file will be shared with the contact
        And the file will be shared with the volume
        And the contact sees a duplicate reference to the file in their drive
        When the contact removes the volume from their drive
        Then they will no longer see the volume in their drive
        But they will still see the file in their drive

    Scenario: Sharing a file from a volume with a user who has been invited to the volume
        When I share a volume with a contact
        And I upload a file into the volume
        And I re-share the file from the volume with that contact
        Then the user will receive a DM referencing the file
        And the file will be shared with the user
        And the file will be shared with the volume
        And the contact sees a duplicate reference to the file in their drive

    Scenario: Sharing a file from a volume with a user who does not share the volume
        When I share a file from a volume with a user who isn't in the volume
        Then the user will receive the file
        But the user will not be invited to the volume
        And the file will be shared with the user
        But the volume will not be shared with the user

