@wip
Feature: Receiving and accepting

    Receiving a file in a chat (room or DM) is considered an invitation to have a file.
    This invitation is extended with some privileges, by default "editor".

    There are currently three roles:

    - Owners can view and re-share as well as edit the list of users with access to the file.
    - Editors can view and re-share a file.
    - Viewers can only view and download the file.

    Invitations to files are implicitly accepted when resharing a file,
    but not when viewing it. Accepting an invitation is the same thing as "adding to your drive".
    However, additional owners of a file will immediately have files they are made owners of added
    to their drive.

    Background:
        Given I am logged in

    Scenario: Download as editor
        When I receive a file with editor privileges
        Then I can download the file
        And I can see the list of users the file is shared with
        But I do not have the file in my drive

    Scenario: Download as viewer
        When I receive a file as a viewer
        Then I can download the file
        And I can see the list of users the file is shared with
        But I do not have the file in my drive

    Scenario: Download as owner
        When I receive a file as an owner
        Then I can download the file
        And I can see the list of users the file is shared with
        And I can see that I am not the uploader
        And I have the file in my drive



