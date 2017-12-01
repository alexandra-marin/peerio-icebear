Feature: Moving files around volumes
    Owners and editors should be able to reorganize files within volumes, including creating
    subfolders inside them. Viewers should not be able to do so, though they should be able to
    navigate the file structure.  

    Background:
        Given I am logged in
        And have a volume

    @owner
    Scenario: Upload file into volume
        When I join the volume
        Then I can upload a file into it
    
    @editor
    Scenario: Upload file into volume
        When I join the volume
        Then I can upload a file into it

    @viewer
    Scenario: Upload file into volume
        When I join the volume
        Then I can see the files in it
        But I cannot upload a file into it

    @owner
    Scenario: Move file into volume
        When I upload a file to my root
        Then I can move it into the volume

    @editor
    Scenario: Move file into volume
        When I upload a file to my root
        Then I can move it into the volume
        
    @viewer
    Scenario: Move file into volume
        When I upload a file to my root
        Then I cannot move it into the volume

    @owner
    Scenario: Create folder in volume
        When I create a folder in a volume
        Then I can upload a file in a folder

    @editor
    Scenario: Create folder in volume
        When I see a folder in a volume
        Then I can upload a file into it
        And I can create another folder

    @viewer
    Scenario: Create folder in volume
        I cannot create a folder

    @owner
    Scenario: Move my file out of volume
        When I upload a file to the volume
        Then I can move it to my root
        And it will no longer be in the volume

    @editor
    Scenario: Move my file out of volume
        When I upload a file to the volume
        Then I can move it to my root
        And it will no longer be in the volume

    @owner
    Scenario: Fail to move someone else's file out of volume
        I cannot move someone else's file out of the volume
    
    @editor
    Scenario: Fail to move someone else's file out of volume
        I cannot move someone else's file out of the volume

    @owner
    Scenario: Move file into subfolder
        When I upload a file
        Then I can move it into a subfolder

    @editor
    Scenario: Move file into subfolder
        When I upload a file
        Then I can move it into a subfolder