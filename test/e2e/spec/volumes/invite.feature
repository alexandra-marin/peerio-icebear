@off
Feature: Inviting users to volumes
    Users who have created volumes should be able to invite other users, have them join, and
    change their privileges.

    Volumes can have *only one* owner.

    The commented out scenarios are for the second stage of the MVP. The first MVP will have
    only read-only volumes.

    Background:
        Given I am logged in
        And I have some contacts

    @owner
    Scenario: Invite viewer to a volume as owner
        Given I create a volume with some files
        When I invite a contact to join as a viewer
        Then the contact will be invited
        And the contact will receive an invitation DM
        When the contact joins
        Then the contact will be listed as a viewer
        And the contact will view the files in the volume
        And the contact can download a file in the volume
        When the contact uploads a file in the volume
        Then the operation fail
        And the file will not be in the volume

    @owner
    Scenario: Invite editor to a volume as owner
        Given I create a volume with some files
        When I invite a contact to join as an editor
        Then the contact will be invited
        And the contact will join
        And the contact will access the files in the volume
        And the contact will be listed as an editor
        When the contact uploads a file in the volume
        Then the file will be shared in the volume
        And I will be able to access it

    @owner
    Scenario: Change volume permissions as owner
        Given I create a volume with some files
        When I invite a contact to join as an editor
        Then the contact will be invited
        And the contact will receive an invitation DM
        And the contact will be listed as an editor
        When the contact uploads a file in the volume
        Then the file will be shared in the volume
        And I will be able to access it
        When I demote the contact to read-only
        Then the contact will be listed as a viewer
        When the contact uploads a file in the volume
        Then the operation fail
        And the file will not be in the volume
        But the contact can download files from the volume

    @editor
    Scenario: Invite viewer to volume as editor
        Given I have joined a volume as an editor
        When I invite a contact to join as a viewer
        Then the contact will be invited
        When the contact joins
        Then the contact will be listed as a viewer
        And the contact will view the files in the volume
        And the contact can download a file in the volume

    @editor
    Scenario: Invite additional editor to volume as editor
        Given I have joined a volume as an editor
        When I invite a contact to join as an editor
        Then the contact will be invited
        And the contact will join
        And the contact will access the files in the volume
        And the contact will be listed as an editor

    @viewer
    Scenario: Cannot invite viewers to volume
        Given I have joined a volume as a viewer
        When I invite a contact to the volume as a viewer
        Then the operation will fail
        And the contact will not be invited

    @viewer
    Scenario: Cannot invite editors to volume
         Given I have joined a volume as a viewer
        When I invite a contact to the volume as an editor
        Then the operation will fail
        And the contact will not be invited
