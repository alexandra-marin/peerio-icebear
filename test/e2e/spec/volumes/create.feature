@wip
Feature: Create a volume
    Users can create, rename, and delete volumes.

    Volumes, like rooms, and like individual users, are considered a kind of entity that a file can be shared with.
    Thus, in a permissions matrix (concrete or imaginary), a file shared with a user and with a volume would list
    the independent permissions for the file and the volume.

    Features that are not supported yet but will be eventually:
    - converting a folder to a volume
    - creating subfolders in volumes

    Background:
        Given I am logged in
        And I have some files
        And I have some contacts

    Scenario: Create volume
        When I create a volume
        And I add files to it
        Then the files will be shared with the volume
        And I can see my files when I list the files in the volume

    Scenario: Share volume
        When I create a volume
        And I add files to it
        And I share the volume with a contact
        Then the volume will be shared with that contact
        But the files will not be individually shared with the contact

    Scenario: Rename volume
        When I create a volume
        And I share the volume with a contact
        Then I can rename it
        And it will be renamed
        And the contact will see the new name

