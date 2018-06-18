Feature: Contact management

    # TODO: these scenarios do not cover realtime cases, when both users are connected
    # TODO: contactStore.getContactAndSave currenly does not report when it's done,
    #       so we can't really test 'encounters', contacts who are not fav,
    #       but we have tofu for them

    Scenario: Find a contact by username or email
        Given I create a test account
        And   I confirm the primary email
        And   I restart without login
        And   I create my account
        Then  I can not find unregistered account by random username
        And   I can find the test account by username
        And   I can find the test account by email
        And   test account is not added to my contacts

    Scenario: Favorite and unfavorite a contact
        Given I create a test account and my account
        When  I favorite the test account
        Then  the test account is my favorite contact
        When  I restart
        Then  the test account is my favorite contact
        When  I unfavorite the test account
        Then  the test account is not my favorite contact
        When  I restart
        Then  the test account is not my favorite contact

    Scenario: Create favorite contact after invited email in confirmed
        Given I create my account
        And   I invite random email
        And   I restart without login
        When  I create a test account with invited email
        And   I confirm the primary email
        And   I restart
        Then  the invite is converted to pending dm

    Scenario: Remove invite before invited email is confirmed
        Given I create my account
        And   I invite random email
        And   I delete invited random email
        And   I restart without login
        When  I create a test account with invited email
        And   I confirm the primary email
        When  I restart
        Then  I don't have pending dm
