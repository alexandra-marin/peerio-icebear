Feature: User account

    User has to be able to
    - create a new account
    - use his credentials to log in
    - delete the account, provided confirmed email exists.
    - modify account settings

    TODO: make sure email confirmation warning arrives

    Background:
        Given I create an account

    Scenario: user creates an account
        Then  I am authenticated
        When  I restart
        And   I login
        Then  I am authenticated

    Scenario: user deletes existing account
        Given I confirm my primary email
        Then  my primary email is confirmed
        When  I delete my account
        Then  I am not authenticated
        When  I restart
        Then  I am not able to login

    Scenario: user modifies account settings
        Then I should have default account settings
        When I change my account settings
        Then my account settings are changed
