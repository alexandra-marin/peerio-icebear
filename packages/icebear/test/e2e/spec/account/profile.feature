Feature: User profile

    User should be able to change own profile details.

    Background:
        Given I create my account

    Scenario: Update names
        When  I change my first name to "TestFirstName1"
        And   I change my last name to "TestLastName1"
        Then  my first name should be "TestFirstName1"
        And   my last name should be "TestLastName1"
        When  I change my first name to "TestFirstName2"
        And   I change my last name to "TestLastName2"
        Then  my first name should be "TestFirstName2"
        And   my last name should be "TestLastName2"
        When  I restart
        Then  my first name should be "TestFirstName2"
        And   my last name should be "TestLastName2"

    # TODO: when server adds limit on the amount of emails you can have - check that limit
    Scenario: Add and confirm maximum allowed emails
        When  I add a new email
        And   I confirm my new email
        Then  my new email is confirmed
        When  I add a new email
        And   I confirm my new email
        Then  my new email is confirmed

    Scenario: Resend comfirmation email
        Given I add a new email
        When  I request confirmation email resend
        And   I confirm my new email
        Then  my new email is confirmed
        When  I restart
        Then  my new email is confirmed

    Scenario: Change primary email
        Given I confirm the primary email
        And   I add a new email
        And   I confirm my new email
        And   my new email is confirmed
        When  I change my primary email
        Then  my primary email has been changed
        When  I restart
        Then  my primary email has been changed

    #@wip
    #Scenario: Remove email

    Scenario: Save beacons
        When  I am shown a beacon
        Then  the beacon appears as seen
        When  I restart
        Then  the beacon appears as seen
